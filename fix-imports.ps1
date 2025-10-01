# Script para corregir imports de alias @/ a rutas relativas

$files = @(
    "src/domain/employees/EmployeeService.ts",
    "src/domain/statements/StatementService.ts", 
    "src/domain/tickets/TicketService.ts",
    "src/domain/transactions/TransactionService.ts",
    "src/jobs/ImportJob.ts",
    "src/jobs/MonthlyCloseJob.ts",
    "src/jobs/QueueManager.ts",
    "src/services/PDFGenerator.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Corrigiendo $file..."
        
        # Leer contenido
        $content = Get-Content $file -Raw
        
        # Reemplazar imports
        $content = $content -replace "from '@/db/client'", "from '../../db/client'"
        $content = $content -replace "from '@/utils/logger'", "from '../../utils/logger'"
        $content = $content -replace "from '@/services/PDFGenerator'", "from '../PDFGenerator'"
        $content = $content -replace "from '@/domain/employees/EmployeeService'", "from '../../domain/employees/EmployeeService'"
        $content = $content -replace "from '@/domain/transactions/TransactionService'", "from '../../domain/transactions/TransactionService'"
        $content = $content -replace "from '@/domain/accounts/AccountService'", "from '../../domain/accounts/AccountService'"
        $content = $content -replace "from '@/domain/statements/StatementService'", "from '../../domain/statements/StatementService'"
        $content = $content -replace "from '@/domain/tickets/TicketService'", "from '../../domain/tickets/TicketService'"
        $content = $content -replace "from '@/jobs/QueueManager'", "from '../QueueManager'"
        $content = $content -replace "from '@/jobs/ImportJob'", "from '../ImportJob'"
        $content = $content -replace "from '@/jobs/MonthlyCloseJob'", "from '../MonthlyCloseJob'"
        
        # Escribir contenido corregido
        Set-Content $file -Value $content -NoNewline
        Write-Host "✓ $file corregido"
    } else {
        Write-Host "⚠ $file no encontrado"
    }
}

Write-Host "Correccion completada!"
