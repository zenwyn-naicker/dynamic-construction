using DynamicConstruction.Api.Infrastructure;

namespace DynamicConstruction.Api.Features.Operations;

public static class Lifecycle
{
    public static void Quote(string from, string to, DateTime? expires, DateTime now)
    {
        var valid = from switch
        {
            "Submitted" => to == "Under Review",
            "Under Review" => to is "Quoted" or "Rejected",
            "Quoted" => to is "Accepted" or "Declined" or "Expired",
            _ => false,
        };
        Guard.Require(valid, "Invalid quote transition.");
        if (to == "Accepted")
            Guard.Require(expires > now, "This formal quote has expired.");
        if (to == "Expired")
            Guard.Require(expires <= now, "Quote has not expired yet.");
    }

    public static void Project(string from, string to, bool complete, string reason)
    {
        var valid = from switch
        {
            "Planned" => to == "Active",
            "Active" => to is "On Hold" or "At Risk" or "Completed",
            "On Hold" => to == "Active",
            "At Risk" => to is "Active" or "Completed",
            "Completed" => to == "Archived",
            _ => false,
        };
        Guard.Require(valid, "Invalid project transition.");
        if (to == "Completed")
            Guard.Require(
                complete || (from == "At Risk" && reason.Length >= 10),
                "Complete all milestones, or record an approved variance on an At Risk project."
            );
        if (to is "On Hold" or "At Risk" || from is "On Hold" or "At Risk")
            Guard.Text(reason, "Reason / approved variance", 10);
    }

    public static void Change(string from, string to)
    {
        var valid = from switch
        {
            "Submitted" => to is "Under Review" or "Withdrawn",
            "Under Review" => to is "Approved" or "Rejected" or "Withdrawn",
            "Approved" => to == "Implemented",
            "Implemented" => to == "Closed",
            "Rejected" => to == "Closed",
            _ => false,
        };
        Guard.Require(valid, "Invalid change transition.");
    }
}
