import { prisma } from '@/db/client';
import { Ticket, TicketTopic, TicketStatus } from '@prisma/client';
import { logger } from '@/utils/logger';

export interface CreateTicketData {
  employeeId: string;
  topic: TicketTopic;
  lastMessage?: string;
  status?: TicketStatus;
}

export interface UpdateTicketData {
  topic?: TicketTopic;
  status?: TicketStatus;
  lastMessage?: string;
}

export interface TicketWithEmployee extends Ticket {
  employee: {
    id: string;
    fullName: string;
    employeeCode: string;
    phoneE164: string;
  };
}

export class TicketService {
  async createTicket(data: CreateTicketData): Promise<Ticket> {
    try {
      const ticket = await prisma.ticket.create({
        data: {
          employeeId: data.employeeId,
          topic: data.topic,
          lastMessage: data.lastMessage || null,
          status: data.status || TicketStatus.ABIERTO
        }
      });

      logger.info(`Ticket created: ${ticket.id} for employee ${data.employeeId}`);
      return ticket;
    } catch (error) {
      logger.error('Error creating ticket:', error);
      throw error;
    }
  }

  async getTicketById(id: string): Promise<TicketWithEmployee | null> {
    try {
      return await prisma.ticket.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              phoneE164: true
            }
          }
        }
      });
    } catch (error) {
      logger.error(`Error getting ticket ${id}:`, error);
      throw error;
    }
  }

  async getTicketsByEmployee(employeeId: string): Promise<Ticket[]> {
    try {
      return await prisma.ticket.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting tickets for employee ${employeeId}:`, error);
      throw error;
    }
  }

  async getTicketsByStatus(status: TicketStatus): Promise<TicketWithEmployee[]> {
    try {
      return await prisma.ticket.findMany({
        where: { status },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              phoneE164: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting tickets by status ${status}:`, error);
      throw error;
    }
  }

  async getTicketsByTopic(topic: TicketTopic): Promise<TicketWithEmployee[]> {
    try {
      return await prisma.ticket.findMany({
        where: { topic },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              phoneE164: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting tickets by topic ${topic}:`, error);
      throw error;
    }
  }

  async getAllTickets(): Promise<TicketWithEmployee[]> {
    try {
      return await prisma.ticket.findMany({
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              phoneE164: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting all tickets:', error);
      throw error;
    }
  }

  async updateTicket(id: string, data: UpdateTicketData): Promise<Ticket> {
    try {
      const ticket = await prisma.ticket.update({
        where: { id },
        data
      });

      logger.info(`Ticket updated: ${id}`);
      return ticket;
    } catch (error) {
      logger.error(`Error updating ticket ${id}:`, error);
      throw error;
    }
  }

  async handoverToHR(id: string): Promise<Ticket> {
    try {
      const ticket = await prisma.ticket.update({
        where: { id },
        data: { 
          status: TicketStatus.DERIVADO_RRHH,
          lastMessage: 'Derivado a RR. HH. para atención personalizada'
        }
      });

      logger.info(`Ticket ${id} handed over to HR`);
      return ticket;
    } catch (error) {
      logger.error(`Error handing over ticket ${id} to HR:`, error);
      throw error;
    }
  }

  async closeTicket(id: string): Promise<Ticket> {
    try {
      const ticket = await prisma.ticket.update({
        where: { id },
        data: { 
          status: TicketStatus.CERRADO,
          lastMessage: 'Ticket cerrado por RR. HH.'
        }
      });

      logger.info(`Ticket ${id} closed`);
      return ticket;
    } catch (error) {
      logger.error(`Error closing ticket ${id}:`, error);
      throw error;
    }
  }

  async getOpenTickets(): Promise<TicketWithEmployee[]> {
    try {
      return await prisma.ticket.findMany({
        where: {
          status: {
            in: [TicketStatus.ABIERTO, TicketStatus.DERIVADO_RRHH]
          }
        },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              phoneE164: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error getting open tickets:', error);
      throw error;
    }
  }

  async getTicketStats(): Promise<{
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    hrTickets: number;
    disputeTickets: number;
    consultationTickets: number;
  }> {
    try {
      const [
        totalTickets,
        openTickets,
        closedTickets,
        hrTickets,
        disputeTickets,
        consultationTickets
      ] = await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.count({ where: { status: TicketStatus.ABIERTO } }),
        prisma.ticket.count({ where: { status: TicketStatus.CERRADO } }),
        prisma.ticket.count({ where: { status: TicketStatus.DERIVADO_RRHH } }),
        prisma.ticket.count({ where: { topic: TicketTopic.DISPUTA } }),
        prisma.ticket.count({ where: { topic: TicketTopic.CONSULTA } })
      ]);

      return {
        totalTickets,
        openTickets,
        closedTickets,
        hrTickets,
        disputeTickets,
        consultationTickets
      };
    } catch (error) {
      logger.error('Error getting ticket stats:', error);
      throw error;
    }
  }

  async searchTickets(query: string): Promise<TicketWithEmployee[]> {
    try {
      return await prisma.ticket.findMany({
        where: {
          OR: [
            { lastMessage: { contains: query, mode: 'insensitive' } },
            { employee: { fullName: { contains: query, mode: 'insensitive' } } },
            { employee: { employeeCode: { contains: query, mode: 'insensitive' } } }
          ]
        },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              phoneE164: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error(`Error searching tickets with query "${query}":`, error);
      throw error;
    }
  }

  async deleteTicket(id: string): Promise<void> {
    try {
      await prisma.ticket.delete({
        where: { id }
      });

      logger.info(`Ticket deleted: ${id}`);
    } catch (error) {
      logger.error(`Error deleting ticket ${id}:`, error);
      throw error;
    }
  }
}
