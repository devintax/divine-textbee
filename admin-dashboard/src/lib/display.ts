export function displayText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    const parts = value.map((item) => displayText(item)).filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : fallback
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const preferred = [record.message, record.data, record.text, record.body, record.error]

    for (const candidate of preferred) {
      const rendered = displayText(candidate)
      if (rendered) return rendered
    }

    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }

  return fallback
}

export function errorText(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error) return displayText(error.message, fallback)
  return displayText(error, fallback)
}
