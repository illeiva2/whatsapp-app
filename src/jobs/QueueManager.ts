import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';

export interface JobData {
  [key: string]: any;
}

export class QueueManager {
  private redis: IORedis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  constructor() {
    this.redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  createQueue(name: string): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.queues.set(name, queue);
    logger.info(`Queue created: ${name}`);
    return queue;
  }

  createWorker(name: string, processor: (job: Job) => Promise<any>): Worker {
    if (this.workers.has(name)) {
      return this.workers.get(name)!;
    }

    const worker = new Worker(name, processor, {
      connection: this.redis,
      concurrency: 5,
    });

    worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed in queue ${name}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed in queue ${name}:`, err);
    });

    worker.on('error', (err) => {
      logger.error(`Worker error in queue ${name}:`, err);
    });

    this.workers.set(name, worker);
    logger.info(`Worker created: ${name}`);
    return worker;
  }

  async addJob(queueName: string, jobName: string, data: JobData, options?: any): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobName, data, options);
    logger.info(`Job added to queue ${queueName}: ${jobName}`);
    return job;
  }

  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  async cleanQueue(queueName: string, grace: number = 0): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.clean(grace, 100);
    logger.info(`Queue ${queueName} cleaned`);
  }

  async closeAll(): Promise<void> {
    // Cerrar workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.info(`Worker ${name} closed`);
    }

    // Cerrar queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`Queue ${name} closed`);
    }

    // Cerrar conexión Redis
    await this.redis.quit();
    logger.info('Redis connection closed');
  }

  getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  getWorker(workerName: string): Worker | undefined {
    return this.workers.get(workerName);
  }
}
