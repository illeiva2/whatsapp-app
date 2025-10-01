import { EmployeeService } from '@/domain/employees/EmployeeService';
import { prisma } from '@/db/client';
import { EmployeeStatus } from '@prisma/client';

// Mock de Prisma
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('EmployeeService', () => {
  let employeeService: EmployeeService;

  beforeEach(() => {
    employeeService = new EmployeeService();
    jest.clearAllMocks();
  });

  describe('createEmployee', () => {
    it('should create a new employee successfully', async () => {
      const employeeData = {
        fullName: 'Juan Perez',
        dni: '20300123',
        phoneE164: '+5491123456789',
        employeeCode: 'E001',
        status: EmployeeStatus.ACTIVE
      };

      const mockEmployee = {
        id: 'emp-123',
        ...employeeData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAccount = {
        id: 'acc-123',
        employeeId: 'emp-123',
        closingDay: 20,
        lastClosingAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.employee.create.mockResolvedValue(mockEmployee);
      mockPrisma.account.create.mockResolvedValue(mockAccount);

      const result = await employeeService.createEmployee(employeeData);

      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: {
          fullName: employeeData.fullName,
          dni: employeeData.dni,
          phoneE164: employeeData.phoneE164,
          employeeCode: employeeData.employeeCode,
          status: employeeData.status
        }
      });

      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          employeeId: mockEmployee.id,
          closingDay: 20
        }
      });

      expect(result).toEqual(mockEmployee);
    });

    it('should throw error when employee creation fails', async () => {
      const employeeData = {
        fullName: 'Juan Perez',
        dni: '20300123',
        phoneE164: '+5491123456789',
        employeeCode: 'E001'
      };

      mockPrisma.employee.create.mockRejectedValue(new Error('Database error'));

      await expect(employeeService.createEmployee(employeeData)).rejects.toThrow('Database error');
    });
  });

  describe('getEmployeeById', () => {
    it('should return employee when found', async () => {
      const mockEmployee = {
        id: 'emp-123',
        fullName: 'Juan Perez',
        dni: '20300123',
        phoneE164: '+5491123456789',
        employeeCode: 'E001',
        status: EmployeeStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: {
          id: 'acc-123',
          employeeId: 'emp-123',
          closingDay: 20,
          lastClosingAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);

      const result = await employeeService.getEmployeeById('emp-123');

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-123' },
        include: { account: true }
      });

      expect(result).toEqual(mockEmployee);
    });

    it('should return null when employee not found', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      const result = await employeeService.getEmployeeById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getEmployeeByPhone', () => {
    it('should return employee when found by phone', async () => {
      const mockEmployee = {
        id: 'emp-123',
        fullName: 'Juan Perez',
        dni: '20300123',
        phoneE164: '+5491123456789',
        employeeCode: 'E001',
        status: EmployeeStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        account: {
          id: 'acc-123',
          employeeId: 'emp-123',
          closingDay: 20,
          lastClosingAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);

      const result = await employeeService.getEmployeeByPhone('+5491123456789');

      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { phoneE164: '+5491123456789' },
        include: { account: true }
      });

      expect(result).toEqual(mockEmployee);
    });
  });

  describe('updateEmployee', () => {
    it('should update employee successfully', async () => {
      const updateData = {
        fullName: 'Juan Carlos Perez',
        status: EmployeeStatus.INACTIVE
      };

      const mockUpdatedEmployee = {
        id: 'emp-123',
        fullName: 'Juan Carlos Perez',
        dni: '20300123',
        phoneE164: '+5491123456789',
        employeeCode: 'E001',
        status: EmployeeStatus.INACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.employee.update.mockResolvedValue(mockUpdatedEmployee);

      const result = await employeeService.updateEmployee('emp-123', updateData);

      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-123' },
        data: updateData
      });

      expect(result).toEqual(mockUpdatedEmployee);
    });
  });

  describe('deactivateEmployee', () => {
    it('should deactivate employee successfully', async () => {
      const mockDeactivatedEmployee = {
        id: 'emp-123',
        fullName: 'Juan Perez',
        dni: '20300123',
        phoneE164: '+5491123456789',
        employeeCode: 'E001',
        status: EmployeeStatus.INACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.employee.update.mockResolvedValue(mockDeactivatedEmployee);

      const result = await employeeService.deactivateEmployee('emp-123');

      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-123' },
        data: { status: EmployeeStatus.INACTIVE }
      });

      expect(result).toEqual(mockDeactivatedEmployee);
    });
  });
});
