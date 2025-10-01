import { prisma } from '../../db/client';
import { Employee, EmployeeStatus } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface CreateEmployeeData {
  fullName: string;
  dni: string;
  phoneE164: string;
  employeeCode: string;
  status?: EmployeeStatus;
}

export interface UpdateEmployeeData {
  fullName?: string;
  dni?: string;
  phoneE164?: string;
  employeeCode?: string;
  status?: EmployeeStatus;
}

export class EmployeeService {
  async createEmployee(data: CreateEmployeeData): Promise<Employee> {
    try {
      const employee = await prisma.employee.create({
        data: {
          fullName: data.fullName,
          dni: data.dni,
          phoneE164: data.phoneE164,
          employeeCode: data.employeeCode,
          status: data.status || EmployeeStatus.ACTIVE
        }
      });

      // Crear cuenta asociada
      await prisma.account.create({
        data: {
          employeeId: employee.id,
          closingDay: 20 // Día 20 por defecto
        }
      });

      logger.info(`Employee created: ${employee.employeeCode}`);
      return employee;
    } catch (error) {
      logger.error('Error creating employee:', error);
      throw error;
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    try {
      return await prisma.employee.findUnique({
        where: { id },
        include: { account: true }
      });
    } catch (error) {
      logger.error(`Error getting employee by id ${id}:`, error);
      throw error;
    }
  }

  async getEmployeeByPhone(phoneE164: string): Promise<Employee | null> {
    try {
      return await prisma.employee.findUnique({
        where: { phoneE164 },
        include: { account: true }
      });
    } catch (error) {
      logger.error(`Error getting employee by phone ${phoneE164}:`, error);
      throw error;
    }
  }

  async getEmployeeByDni(dni: string): Promise<Employee | null> {
    try {
      return await prisma.employee.findUnique({
        where: { dni },
        include: { account: true }
      });
    } catch (error) {
      logger.error(`Error getting employee by DNI ${dni}:`, error);
      throw error;
    }
  }

  async getEmployeeByCode(employeeCode: string): Promise<Employee | null> {
    try {
      return await prisma.employee.findUnique({
        where: { employeeCode },
        include: { account: true }
      });
    } catch (error) {
      logger.error(`Error getting employee by code ${employeeCode}:`, error);
      throw error;
    }
  }

  async updateEmployee(id: string, data: UpdateEmployeeData): Promise<Employee> {
    try {
      const employee = await prisma.employee.update({
        where: { id },
        data
      });

      logger.info(`Employee updated: ${employee.employeeCode}`);
      return employee;
    } catch (error) {
      logger.error(`Error updating employee ${id}:`, error);
      throw error;
    }
  }

  async getAllEmployees(): Promise<Employee[]> {
    try {
      return await prisma.employee.findMany({
        include: { account: true },
        orderBy: { fullName: 'asc' }
      });
    } catch (error) {
      logger.error('Error getting all employees:', error);
      throw error;
    }
  }

  async getActiveEmployees(): Promise<Employee[]> {
    try {
      return await prisma.employee.findMany({
        where: { status: EmployeeStatus.ACTIVE },
        include: { account: true },
        orderBy: { fullName: 'asc' }
      });
    } catch (error) {
      logger.error('Error getting active employees:', error);
      throw error;
    }
  }

  async deactivateEmployee(id: string): Promise<Employee> {
    try {
      const employee = await prisma.employee.update({
        where: { id },
        data: { status: EmployeeStatus.INACTIVE }
      });

      logger.info(`Employee deactivated: ${employee.employeeCode}`);
      return employee;
    } catch (error) {
      logger.error(`Error deactivating employee ${id}:`, error);
      throw error;
    }
  }

  async searchEmployees(query: string): Promise<Employee[]> {
    try {
      return await prisma.employee.findMany({
        where: {
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { employeeCode: { contains: query, mode: 'insensitive' } },
            { dni: { contains: query } }
          ]
        },
        include: { account: true },
        orderBy: { fullName: 'asc' }
      });
    } catch (error) {
      logger.error(`Error searching employees with query "${query}":`, error);
      throw error;
    }
  }
}
