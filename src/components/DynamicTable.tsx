import { ReactNode } from "react";

export type DynamicTableColumn<T> = {
  header: ReactNode;
  field: keyof T;
  render?: (value: T[keyof T], row: T) => ReactNode;
};

type DynamicTableProps<T> = {
  columns: DynamicTableColumn<T>[];
  data: T[];
  emptyText?: string;
  tableClassName?: string;
  headClassName?: string;
  cellClassName?: string;
  emptyClassName?: string;
};

export function DynamicTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyText = "Không có dữ liệu",
  tableClassName,
  headClassName,
  cellClassName,
  emptyClassName,
}: DynamicTableProps<T>) {
  if (!data.length) {
    return <div className={emptyClassName}>{emptyText}</div>;
  }

  return (
    <table className={tableClassName}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={String(column.field)} className={headClassName} data-field={String(column.field)}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => {
              const value = row[column.field];

              return (
                <td key={String(column.field)} className={cellClassName} data-field={String(column.field)}>
                  {column.render ? column.render(value, row) : String(value ?? "")}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}