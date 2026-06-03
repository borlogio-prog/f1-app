export default function DriverBadge({ driver, size = 'md' }) {
  const color = driver?.team_colour ? `#${driver.team_colour}` : '#666'
  const sizes = { sm: 'w-6 h-6 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' }

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
      title={driver?.full_name}
    >
      {driver?.name_acronym ?? '???'}
    </div>
  )
}
