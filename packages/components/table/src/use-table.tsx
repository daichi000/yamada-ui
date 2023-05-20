import {
  ColumnDef,
  Row,
  Cell,
  RowData,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  CoreOptions,
  RowSelectionOptions,
  SortingOptions,
  Header,
  PartialKeys,
  SortingState,
  RowSelectionState,
  OnChangeFn,
  PaginationOptions,
  getPaginationRowModel,
  HeaderContext,
} from '@tanstack/react-table'
import { Checkbox, CheckboxProps } from '@yamada-ui/checkbox'
import { ui, CSSUIObject, HTMLUIProps, ThemeProps } from '@yamada-ui/core'
import { IconProps } from '@yamada-ui/icon'
import { ThProps, TrProps, TdProps } from '@yamada-ui/native-table'
import { useControllableState } from '@yamada-ui/use-controllable-state'
import { createContext, PropGetter, handlerAll, runIfFunc } from '@yamada-ui/utils'
import { CSSProperties, useCallback, useMemo } from 'react'

export { flexRender as render, createColumnHelper } from '@tanstack/react-table'
export type { SortDirection, Row, Cell, RowData } from '@tanstack/react-table'

export type TableContext = Omit<UseTableReturn, 'getTableProps'>

export const [TableProvider, useTableContext] = createContext<TableContext>({
  strict: false,
  name: 'TableContext',
})

export type ColumnStyles = {
  className?: string
  style?: CSSProperties
  sx?: CSSUIObject
  css?: CSSUIObject
}

export type Column<Y extends RowData, M = unknown> = ColumnDef<Y, M> & ColumnStyles

type SelectColumn<Y extends RowData, M = unknown> = Omit<Column<Y, M>, 'accessorKey' | 'accessorFn'>

export type ColumnSort<Y extends RowData> = {
  id: keyof Y
  desc: boolean
}

export type Sort<Y extends RowData> = ColumnSort<Y>[]

export type UseTableOptions<Y extends RowData> = PartialKeys<
  Omit<
    CoreOptions<Y>,
    'getCoreRowModel' | 'state' | 'initialState' | 'onStateChange' | 'getSubRows' | 'mergeOptions'
  >,
  'renderFallbackValue'
> &
  Omit<SortingOptions<Y>, 'getSortedRowModel' | 'onSortingChange'> &
  Omit<
    RowSelectionOptions<Y>,
    'enableMultiRowSelection' | 'enableSubRowSelection' | 'onRowSelectionChange'
  > &
  Omit<PaginationOptions, 'getPaginationRowModel' | 'onPaginationChange'>

type TableProps = HTMLUIProps<'table'> & ThemeProps<'Table'>

type HeaderGroupProps<Y extends RowData> =
  | Omit<TrProps, 'key'>
  | ((headers: Header<Y, unknown>[]) => Omit<TrProps, 'key'> | void)
type HeaderProps<Y extends RowData> =
  | Omit<ThProps, 'key'>
  | ((header: Header<Y, unknown>) => Omit<ThProps, 'key'> | void)
type RowProps<Y extends RowData> =
  | Omit<TrProps, 'key'>
  | ((row: Row<Y>) => Omit<TrProps, 'key'> | void)
type CellProps<Y extends RowData> =
  | Omit<TdProps, 'key'>
  | ((cell: Cell<Y, unknown>) => Omit<TdProps, 'key'> | void)

export type UseTableProps<Y extends RowData> = TableProps &
  UseTableOptions<Y> & {
    rowId?: keyof Y
    sort?: Sort<Y>
    defaultSort?: Sort<Y>
    onChangeSort?: (sort: Sort<Y>) => void
    selectedRowIds?: string[]
    defaultSelectedRowIds?: string[]
    onChangeSelect?: (rowSelection: string[]) => void
    pageIndex?: number
    defaultPageIndex?: number
    onChangePageIndex?: (pageIndex: number) => void
    pageSize?: number
    defaultPageSize?: number
    onChangePageSize?: (pageIndex: number) => void
    rowsClickSelect?: boolean
    onClickRow?: (row: Row<Y>) => void
    withFooterSelect?: boolean
    disabledRowIds?: string[]
    pageSizeList?: number[]
    checkboxProps?: CheckboxProps
    headerGroupProps?: HeaderGroupProps<Y>
    headerProps?: HeaderProps<Y>
    footerGroupProps?: HeaderGroupProps<Y>
    footerProps?: HeaderProps<Y>
    sortIconProps?: IconProps
    rowProps?: RowProps<Y>
    cellProps?: CellProps<Y>
    selectColumn?: SelectColumn<Y>
    enablePagenation?: boolean
  }

const generateRowSelection = <Y extends RowData>(
  rowSelection: string[] | undefined,
  enableRowSelection: UseTableProps<Y>['enableRowSelection'],
): RowSelectionState => {
  if (!enableRowSelection) return {}

  if (rowSelection) {
    return rowSelection.reduce<RowSelectionState>(
      (prev, id) => ({ ...prev, [String(id)]: true }),
      {},
    )
  } else {
    return {}
  }
}

const generateRowId = <Y extends RowData>(key: keyof Y | undefined) =>
  key ? (row: Y) => String(row[key]) : undefined

const computedEnableRowSelection = <Y extends RowData>({ id }: Row<Y>, disabledRowIds?: string[]) =>
  !disabledRowIds?.includes(id)

export const useTable = <Y extends RowData>({
  rowId,
  disabledRowIds,
  sort,
  defaultSort,
  onChangeSort,
  selectedRowIds,
  defaultSelectedRowIds,
  onChangeSelect,
  pageIndex,
  defaultPageIndex = 0,
  onChangePageIndex,
  pageSize,
  defaultPageSize = 20,
  onChangePageSize,
  rowsClickSelect,
  onClickRow,
  withFooterSelect,
  pageSizeList = [20, 50, 100],
  checkboxProps,
  headerGroupProps,
  headerProps,
  footerGroupProps,
  footerProps,
  sortIconProps,
  rowProps,
  cellProps,
  selectColumn,
  data,
  columns,
  defaultColumn,
  debugAll,
  debugTable,
  debugHeaders,
  debugColumns,
  debugRows,
  autoResetAll,
  meta,
  getRowId = generateRowId(rowId),
  renderFallbackValue,
  manualSorting,
  enableSorting,
  enableSortingRemoval,
  enableMultiRemove,
  enableMultiSort,
  sortDescFirst,
  maxMultiSortColCount,
  isMultiSortEvent,
  sortingFns,
  enableRowSelection = (row) => computedEnableRowSelection(row, disabledRowIds),
  pageCount,
  manualPagination,
  autoResetPageIndex,
  enablePagenation = false,
  ...rest
}: UseTableProps<Y>) => {
  const [sorting, onSortingChange] = useControllableState({
    value: sort,
    defaultValue: defaultSort,
    onChange: onChangeSort,
  }) as unknown as [SortingState, OnChangeFn<SortingState>]

  const [rowSelection, onRowSelectionChange] = useControllableState({
    value: selectedRowIds,
    defaultValue: defaultSelectedRowIds,
    onChange: onChangeSelect,
  })

  const [internalPageIndex, setInternalPageIndex] = useControllableState({
    value: pageIndex,
    defaultValue: defaultPageIndex,
    onChange: onChangePageIndex,
  })

  const [internalPageSize, setInternalPageSize] = useControllableState({
    value: pageSize,
    defaultValue: defaultPageSize,
    onChange: onChangePageSize,
  })

  const computedPageSizeList = useMemo(() => {
    if (!enablePagenation) return []

    let mergedPageSizeList = pageSizeList

    if (internalPageSize && !mergedPageSizeList.includes(internalPageSize))
      mergedPageSizeList.push(internalPageSize)

    mergedPageSizeList = mergedPageSizeList.sort((a, b) => a - b)

    return mergedPageSizeList
  }, [enablePagenation, internalPageSize, pageSizeList])

  const computedRowSelection = useMemo(
    () => generateRowSelection(rowSelection, enableRowSelection),
    [enableRowSelection, rowSelection],
  )

  const mergedColumns = useMemo(
    () =>
      enableRowSelection
        ? mergeColumns<Y>({
            enablePagenation,
            columns,
            checkboxProps,
            withFooterSelect,
            selectColumn,
            disabledRowIds,
          })
        : columns,
    [
      checkboxProps,
      columns,
      disabledRowIds,
      enablePagenation,
      enableRowSelection,
      selectColumn,
      withFooterSelect,
    ],
  )

  const pagination = useMemo(
    () => ({ pageIndex: internalPageIndex, pageSize: internalPageSize }),
    [internalPageIndex, internalPageSize],
  )

  const {
    getHeaderGroups,
    getRowModel,
    getFooterGroups,
    getState,
    setPageIndex,
    previousPage,
    nextPage,
    getCanNextPage,
    getCanPreviousPage,
    setPageSize,
    getPageCount,
  } = useReactTable<Y>({
    data,
    columns: mergedColumns,
    state: {
      sorting,
      rowSelection: computedRowSelection,
      ...(enablePagenation ? { pagination } : {}),
    },
    defaultColumn,
    debugAll,
    debugTable,
    debugHeaders,
    debugColumns,
    debugRows,
    autoResetAll,
    meta,
    getRowId,
    renderFallbackValue,
    manualSorting,
    onSortingChange,
    enableSorting,
    enableSortingRemoval,
    enableMultiRemove,
    enableMultiSort,
    sortDescFirst,
    maxMultiSortColCount,
    sortingFns,
    ...(isMultiSortEvent ? { isMultiSortEvent } : {}),
    enableRowSelection,
    onRowSelectionChange: (updaterOrValue) =>
      onRowSelectionChange(Object.keys(runIfFunc(updaterOrValue, computedRowSelection))),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(enablePagenation
      ? {
          pageCount,
          manualPagination,
          autoResetPageIndex,
          onPaginationChange: (updaterOrValue) => {
            const { pageIndex, pageSize } = runIfFunc(updaterOrValue, pagination)

            setInternalPageIndex(pageIndex)
            setInternalPageSize(pageSize)
          },
          getPaginationRowModel: getPaginationRowModel(),
        }
      : {}),
  })

  const getTableProps: PropGetter = useCallback(
    (props = {}, ref = null) => ({
      ...rest,
      ...props,
      ref,
    }),
    [rest],
  )

  const state = getState()
  const headerGroups = getHeaderGroups()
  const footerGroups = getFooterGroups()
  const { rows, flatRows, rowsById } = getRowModel()
  const totalPage = getPageCount()

  return {
    state,
    getTableProps,
    headerGroups,
    footerGroups,
    rows,
    flatRows,
    rowsById,
    enableRowSelection,
    rowsClickSelect,
    onClickRow,
    setPageIndex,
    previousPage,
    nextPage,
    getCanNextPage,
    getCanPreviousPage,
    setPageSize,
    totalPage,
    pageSizeList: computedPageSizeList,
    headerGroupProps,
    headerProps,
    footerGroupProps,
    footerProps,
    sortIconProps,
    rowProps,
    cellProps,
  }
}

export type UseTableReturn = ReturnType<typeof useTable>

const Center = ui('div', {
  baseStyle: {
    w: '100%',
    h: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
})

const TotalCheckbox = <Y extends RowData>({
  table,
  checkboxProps,
  enablePagenation,
  disabledRowIds = [],
}: {
  table: HeaderContext<Y, unknown>['table']
  checkboxProps: CheckboxProps
  enablePagenation: boolean
  disabledRowIds?: string[]
}) => {
  const {
    getState,
    getRowModel,
    getIsAllRowsSelected,
    getIsSomeRowsSelected,
    getToggleAllRowsSelectedHandler,
    getIsAllPageRowsSelected,
    getIsSomePageRowsSelected,
    getToggleAllPageRowsSelectedHandler,
  } = table

  const state = getState()
  const { rows } = getRowModel()
  const rowIds = rows.map(({ id }) => id)
  const selectedRowIds = Object.keys(state.rowSelection)
  const unselectedRowIds = rowIds.filter((id) => !selectedRowIds.includes(id))

  const isAllChecked = unselectedRowIds.every((id) => disabledRowIds.includes(id))
  const isChecked = !enablePagenation ? getIsAllRowsSelected() : getIsAllPageRowsSelected()
  const isIndeterminate = !enablePagenation ? getIsSomeRowsSelected() : getIsSomePageRowsSelected()
  const onChange = !enablePagenation
    ? getToggleAllRowsSelectedHandler()
    : getToggleAllPageRowsSelectedHandler()

  return (
    <Center>
      <Checkbox
        {...{ gap: 0, ...checkboxProps }}
        isChecked={isAllChecked || isChecked}
        {...(!isAllChecked ? { isIndeterminate } : {})}
        onChange={handlerAll(checkboxProps.onChange, onChange)}
      />
    </Center>
  )
}

export const mergeColumns = <Y extends RowData>({
  enablePagenation,
  columns,
  checkboxProps = {},
  withFooterSelect,
  selectColumn,
  disabledRowIds,
}: {
  enablePagenation: boolean
  columns: Column<Y>[]
  checkboxProps?: CheckboxProps
  withFooterSelect?: boolean
  selectColumn?: SelectColumn<Y>
  disabledRowIds?: string[]
}): Column<Y>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <TotalCheckbox {...{ table, checkboxProps, enablePagenation, disabledRowIds }} />
    ),
    ...(withFooterSelect
      ? {
          footer: ({ table }) => (
            <TotalCheckbox {...{ table, checkboxProps, enablePagenation, disabledRowIds }} />
          ),
        }
      : {}),
    cell: ({ row }) => {
      const { getIsSelected, getCanSelect, getToggleSelectedHandler } = row

      return (
        <Center>
          <Checkbox
            {...{ gap: 0, ...checkboxProps }}
            isChecked={getIsSelected()}
            isDisabled={!getCanSelect()}
            onChange={handlerAll(checkboxProps.onChange, getToggleSelectedHandler())}
          />
        </Center>
      )
    },
    ...selectColumn,
  },
  ...columns,
]
