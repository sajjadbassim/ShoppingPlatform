using ecommerce.Core.Models;

namespace ecommerce.Core.Constants
{
    // جزء على رحلة سائق: التعيين لا يغيّر الحالة — يبقى «جاهز للاستلام» مع معرّف السائق حتى يستلمه من المتجر،
    // وعند الاستلام فقط يصير «في الطريق». فلا يرى الزبون «في الطريق» قبل خروج البضاعة، وتلغيه العمليات أو تسحبه
    // قبل الاستلام دون أن يمرّ الخط الزمني بخطوة لم تحدث
    public static class DriverTrip
    {
        // حالات الجزء المفتوح مع سائقه (للاستعلامات: DriverId == x && Statuses.Contains(Status))
        public static readonly string[] Statuses = { OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY };

        public static bool IsOpen(SubOrder so) => so.DriverId != null && Statuses.Contains(so.Status);

        // معيَّن ولم يستلمه السائق من المتجر بعد
        public static bool AwaitingPickup(SubOrder so) => so.DriverId != null && so.Status == OrderStatus.READY;
    }
}
