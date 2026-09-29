namespace ecommerce.Core.Interfaces
{
    // القيم تُضبط تلقائياً عبر AuditableEntityInterceptor — لا تُضبط يدوياً
    public interface IAuditableEntity
    {
        DateTime CreatedAt { get; set; }
        DateTime? UpdatedAt { get; set; }
    }
}
