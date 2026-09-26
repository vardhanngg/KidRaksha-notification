package com.kidraksha.child.notification

object NotificationText {
    fun clean(value: CharSequence?, maxChars: Int): String? {
        if (value == null || maxChars <= 0) return null

        val cleaned = value.toString()
            .replace("\r\n", "\n")
            .replace('\r', '\n')
            .replace('\u0000'.toString(), "")
            .filter { ch -> ch == '\n' || ch == '\t' || !ch.isISOControl() }
            .split('\n')
            .joinToString("\n") { line ->
                line.replace(Regex("[\\t ]+"), " ").trim()
            }
            .replace(Regex("\\n{3,}"), "\n\n")
            .trim()

        if (cleaned.isEmpty()) return null
        return cleaned.take(maxChars)
    }

    fun joinLines(lines: Array<CharSequence>?): String? {
        if (lines.isNullOrEmpty()) return null
        return clean(lines.joinToString("\n") { it.toString() }, 5000)
    }

    fun firstNonBlank(vararg values: CharSequence?): String? =
        values.firstNotNullOfOrNull { clean(it, 5000) }
}
