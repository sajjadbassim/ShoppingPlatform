import { useState } from 'react'
import { ChevronUp, ChevronDown, MoreVertical } from 'lucide-react'
import { Checkbox } from './FormControls'

/**
 * Table Component
 * 
 * @param {Array} columns - [{key, label, sortable?, width?, render?}]
 * @param {Array} data - البيانات
 * @param {boolean} selectable - قابل للتحديد
 * @param {Array} selectedRows - الصفوف المحددة
 * @param {function} onSelectionChange - دالة تغيير التحديد
 * @param {function} onSort - دالة الترتيب
 * @param {object} sortConfig - {key, direction}
 * @param {boolean} loading - حالة التحميل
 * @param {string} emptyMessage - رسالة عند عدم وجود بيانات
 */
const Table = ({
  columns = [],
  data = [],
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  onSort,
  sortConfig,
  loading = false,
  emptyMessage = 'لا توجد بيانات',
  onRowClick,
  rowActions,
  className = '',
}) => {
  const [openActionMenu, setOpenActionMenu] = useState(null)

  // التحقق من تحديد الكل
  const isAllSelected = data.length > 0 && selectedRows.length === data.length
  const isPartiallySelected = selectedRows.length > 0 && selectedRows.length < data.length

  // تحديد/إلغاء تحديد الكل
  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange?.([])
    } else {
      onSelectionChange?.(data.map((_, index) => index))
    }
  }

  // تحديد/إلغاء تحديد صف
  const handleSelectRow = (index) => {
    if (selectedRows.includes(index)) {
      onSelectionChange?.(selectedRows.filter((i) => i !== index))
    } else {
      onSelectionChange?.([...selectedRows, index])
    }
  }

  // الترتيب
  const handleSort = (key) => {
    if (onSort) {
      const direction = 
        sortConfig?.key === key && sortConfig?.direction === 'asc' 
          ? 'desc' 
          : 'asc'
      onSort({ key, direction })
    }
  }

  // أيقونة الترتيب
  const SortIcon = ({ columnKey }) => {
    if (sortConfig?.key !== columnKey) {
      return (
        <span className="opacity-0 group-hover:opacity-50">
          <ChevronUp size={14} />
        </span>
      )
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} className="text-primary" />
      : <ChevronDown size={14} className="text-primary" />
  }

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        {/* Header */}
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {/* Checkbox Column */}
            {selectable && (
              <th className="w-12 px-4 py-3 text-right">
                <Checkbox
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className={isPartiallySelected ? 'opacity-50' : ''}
                />
              </th>
            )}

            {/* Data Columns */}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`
                  px-4 py-3 text-right text-sm font-semibold text-gray-700
                  ${column.sortable ? 'cursor-pointer select-none group' : ''}
                `}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center gap-1">
                  <span>{column.label}</span>
                  {column.sortable && <SortIcon columnKey={column.key} />}
                </div>
              </th>
            ))}

            {/* Actions Column */}
            {rowActions && (
              <th className="w-12 px-4 py-3 text-right">
                <span className="sr-only">الإجراءات</span>
              </th>
            )}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {loading ? (
            // Loading State
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={index} className="border-b border-gray-100">
                {selectable && (
                  <td className="px-4 py-4">
                    <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-4">
                    <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                  </td>
                )}
              </tr>
            ))
          ) : data.length === 0 ? (
            // Empty State
            <tr>
              <td 
                colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                className="px-4 py-12 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            // Data Rows
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`
                  border-b border-gray-100 transition-colors
                  ${selectedRows.includes(rowIndex) ? 'bg-primary-light/30' : 'hover:bg-gray-50'}
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
                onClick={() => onRowClick?.(row, rowIndex)}
              >
                {/* Checkbox */}
                {selectable && (
                  <td 
                    className="px-4 py-3" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedRows.includes(rowIndex)}
                      onChange={() => handleSelectRow(rowIndex)}
                    />
                  </td>
                )}

                {/* Data Cells */}
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm text-gray-600">
                    {column.render 
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key]
                    }
                  </td>
                ))}

                {/* Actions */}
                {rowActions && (
                  <td 
                    className="px-4 py-3 relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                      onClick={() => setOpenActionMenu(openActionMenu === rowIndex ? null : rowIndex)}
                    >
                      <MoreVertical size={18} className="text-gray-500" />
                    </button>

                    {/* Action Menu */}
                    {openActionMenu === rowIndex && (
                      <>
                        <div 
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenActionMenu(null)}
                        />
                        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-dropdown z-50 min-w-[150px] py-1">
                          {rowActions(row, rowIndex).map((action, actionIndex) => (
                            <button
                              key={actionIndex}
                              className={`
                                w-full px-4 py-2 text-right text-sm flex items-center gap-2
                                transition-colors
                                ${action.danger 
                                  ? 'text-error hover:bg-error-light' 
                                  : 'text-gray-700 hover:bg-gray-50'
                                }
                              `}
                              onClick={() => {
                                action.onClick?.(row, rowIndex)
                                setOpenActionMenu(null)
                              }}
                            >
                              {action.icon && <action.icon size={16} />}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}


/**
 * DataTable Component - جدول مع فلترة وترقيم
 */
export const DataTable = ({
  columns,
  data,
  loading,
  // Pagination
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  // Selection
  selectable,
  selectedRows,
  onSelectionChange,
  // Sort
  sortConfig,
  onSort,
  // Other
  onRowClick,
  rowActions,
  emptyMessage,
  className = '',
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <Table
        columns={columns}
        data={data}
        loading={loading}
        selectable={selectable}
        selectedRows={selectedRows}
        onSelectionChange={onSelectionChange}
        sortConfig={sortConfig}
        onSort={onSort}
        onRowClick={onRowClick}
        rowActions={rowActions}
        emptyMessage={emptyMessage}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            صفحة {currentPage} من {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
            >
              السابق
            </button>
            <button
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Table
