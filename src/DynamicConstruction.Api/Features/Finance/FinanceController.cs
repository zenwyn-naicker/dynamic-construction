using DynamicConstruction.Api.Domain;
using DynamicConstruction.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DynamicConstruction.Api.Features.Finance;

public static class FinanceRules
{
    public static void Amount(decimal amount, decimal paid = 0)
    {
        Guard.Require(
            decimal.Round(amount, 2) == amount && decimal.Round(paid, 2) == paid,
            "Currency amounts must have at most two decimal places."
        );
        Guard.Require(
            amount > 0 && amount <= 100000000,
            "Amount must be greater than zero and no more than R100,000,000."
        );
        Guard.Require(
            paid >= 0 && paid <= amount,
            "Paid amount cannot be negative or exceed the invoice amount."
        );
    }
}

[ApiController, Authorize, Route("api/projects/{projectId:guid}/finance")]
public class FinanceController(AppDbContext db, Access access) : ControllerBase
{
    [HttpGet]
    public async Task<object> Get(Guid projectId)
    {
        var p = await access.Project(projectId);
        var budgets = await db
            .Budgets.AsNoTracking()
            .Where(x => x.ProjectId == projectId && (access.Staff || x.Published))
            .ToListAsync();
        var invoices = await db
            .Invoices.AsNoTracking()
            .Where(x => x.ProjectId == projectId && (access.Staff || x.Published))
            .OrderBy(x => x.DueAt)
            .ToListAsync();
        return new
        {
            p.ContractValue,
            budgets,
            invoices,
            budgetTotal = budgets.Sum(x => x.Amount),
            invoiced = invoices.Sum(x => x.Amount),
            paid = invoices.Sum(x => x.Paid),
            outstanding = invoices.Sum(x => x.Amount - x.Paid),
        };
    }

    public record BudgetInput(
        Guid? Id,
        Guid Version,
        string Description,
        decimal Amount,
        bool Published
    );

    [Authorize(Policy = "Staff"), HttpPost("budgets")]
    public async Task<IActionResult> Budget(Guid projectId, BudgetInput input)
    {
        await access.Project(projectId);
        FinanceRules.Amount(input.Amount);
        var b = input.Id.HasValue
            ? await db.Budgets.SingleOrDefaultAsync(x =>
                x.Id == input.Id && x.ProjectId == projectId
            ) ?? throw new AppError(404, "Budget item not found.")
            : new BudgetItem { ProjectId = projectId };
        if (input.Id.HasValue)
            Guard.Version(b, input.Version);
        else
            db.Budgets.Add(b);
        b.Description = Guard.Text(input.Description, "Description", 3, 500);
        b.Amount = input.Amount;
        b.Published = input.Published;
        access.Audit("Budget.Save", b.Id);
        await db.SaveChangesAsync();
        return Ok(b);
    }

    public record InvoiceInput(
        Guid? Id,
        Guid Version,
        string Number,
        string Description,
        decimal Amount,
        decimal Paid,
        DateTime DueAt,
        bool Published
    );

    [Authorize(Policy = "Staff"), HttpPost("invoices")]
    public async Task<IActionResult> Invoice(Guid projectId, InvoiceInput input)
    {
        await access.Project(projectId);
        FinanceRules.Amount(input.Amount, input.Paid);
        Guard.Require(
            input.DueAt.Year >= 2020 && input.DueAt.Year <= 2100,
            "Enter a valid due date."
        );
        var inv = input.Id.HasValue
            ? await db.Invoices.SingleOrDefaultAsync(x =>
                x.Id == input.Id && x.ProjectId == projectId
            ) ?? throw new AppError(404, "Invoice not found.")
            : new Invoice { ProjectId = projectId };
        if (input.Id.HasValue)
            Guard.Version(inv, input.Version);
        else
            db.Invoices.Add(inv);
        inv.Number = Guard.Text(input.Number, "Invoice number", 3, 50).ToUpperInvariant();
        inv.Description = Guard.Text(input.Description, "Description", 3, 500);
        inv.Amount = input.Amount;
        inv.Paid = input.Paid;
        inv.DueAt = input.DueAt;
        inv.Published = input.Published;
        access.Audit("Invoice.Save", inv.Id);
        await db.SaveChangesAsync();
        return Ok(inv);
    }
}
