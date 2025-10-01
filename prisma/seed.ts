import { PrismaClient } from '@prisma/client';
import { EmployeeStatus, TransactionType, TicketTopic, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Crear empleados de ejemplo
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        fullName: 'Juan Perez',
        dni: '20300123',
        phoneE164: '+5491123456789',
        employeeCode: 'E001',
        status: EmployeeStatus.ACTIVE
      }
    }),
    prisma.employee.create({
      data: {
        fullName: 'Ana Lopez',
        dni: '27111222',
        phoneE164: '+5491198765432',
        employeeCode: 'E002',
        status: EmployeeStatus.ACTIVE
      }
    }),
    prisma.employee.create({
      data: {
        fullName: 'Carlos Rodriguez',
        dni: '12345678',
        phoneE164: '+5491155555555',
        employeeCode: 'E003',
        status: EmployeeStatus.ACTIVE
      }
    })
  ]);

  console.log(`✅ Created ${employees.length} employees`);

  // Crear cuentas para los empleados
  const accounts = await Promise.all(
    employees.map(employee =>
      prisma.account.create({
        data: {
          employeeId: employee.id,
          closingDay: 20
        }
      })
    )
  );

  console.log(`✅ Created ${accounts.length} accounts`);

  // Crear transacciones de ejemplo
  const transactions = await Promise.all([
    // Juan Perez
    prisma.transaction.create({
      data: {
        accountId: accounts[0].id,
        type: TransactionType.PANADERIA,
        description: 'Factura 123',
        amountCents: 150000, // $1500.00
        postedAt: new Date('2025-01-05'),
        sourceRef: 'seed-001'
      }
    }),
    prisma.transaction.create({
      data: {
        accountId: accounts[0].id,
        type: TransactionType.CARNICERIA,
        description: 'Ticket 77',
        amountCents: 820050, // $8200.50
        postedAt: new Date('2025-01-10'),
        sourceRef: 'seed-002'
      }
    }),
    prisma.transaction.create({
      data: {
        accountId: accounts[0].id,
        type: TransactionType.ADELANTO,
        description: 'Adelanto quincena',
        amountCents: 3000000, // $30000.00
        postedAt: new Date('2025-01-20'),
        sourceRef: 'seed-003'
      }
    }),

    // Ana Lopez
    prisma.transaction.create({
      data: {
        accountId: accounts[1].id,
        type: TransactionType.PROVEEDORES,
        description: 'Compra limpieza',
        amountCents: 450000, // $4500.00
        postedAt: new Date('2025-01-22'),
        sourceRef: 'seed-004'
      }
    }),
    prisma.transaction.create({
      data: {
        accountId: accounts[1].id,
        type: TransactionType.PANADERIA,
        description: 'Pan y facturas',
        amountCents: 120000, // $1200.00
        postedAt: new Date('2025-01-15'),
        sourceRef: 'seed-005'
      }
    }),

    // Carlos Rodriguez
    prisma.transaction.create({
      data: {
        accountId: accounts[2].id,
        type: TransactionType.CARNICERIA,
        description: 'Carnes para el mes',
        amountCents: 1500000, // $15000.00
        postedAt: new Date('2025-01-08'),
        sourceRef: 'seed-006'
      }
    }),
    prisma.transaction.create({
      data: {
        accountId: accounts[2].id,
        type: TransactionType.ADELANTO,
        description: 'Adelanto sueldo',
        amountCents: 2500000, // $25000.00
        postedAt: new Date('2025-01-25'),
        sourceRef: 'seed-007'
      }
    })
  ]);

  console.log(`✅ Created ${transactions.length} transactions`);

  // Crear un statement de ejemplo para Juan Perez
  const statement = await prisma.statement.create({
    data: {
      accountId: accounts[0].id,
      periodStart: new Date('2024-12-01'),
      periodEnd: new Date('2024-12-31'),
      closingBalanceCents: 500000, // $5000.00
      pdfUrl: '/storage/statements/E001-2024-12-31.pdf'
    }
  });

  console.log(`✅ Created statement for Juan Perez`);

  // Crear un ticket de ejemplo
  const ticket = await prisma.ticket.create({
    data: {
      employeeId: employees[0].id,
      topic: TicketTopic.CONSULTA,
      status: TicketStatus.ABIERTO,
      lastMessage: 'Consulta sobre saldo de cuenta corriente'
    }
  });

  console.log(`✅ Created ticket for Juan Perez`);

  // Actualizar fecha de último cierre para Juan Perez
  await prisma.account.update({
    where: { id: accounts[0].id },
    data: { lastClosingAt: new Date('2024-12-31') }
  });

  console.log('✅ Updated last closing date for Juan Perez');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
