package com.kidraksha.child.notification

object NotificationText {
    fun clean(value: CharSequence?, maxChars: Int): String? {
        if (value == null) return null
        val cleaned = value.toString()
            .replace('\u0000'.toString(), "")
            .filter { ch -> ch == '\n' || ch == '\r' || ch == '\t' || !ch.isISOControl() }
            .replace(Regex("[\\t ]+"), " ")
            .replace(Regex("\\n{2,}"), "\n")
            .trim()
        if (cleaned.isEmpty()) return null
        return cleaned.take(maxChars)
    }

    fun joinLines(lines: Array<CharSequence>?): String? {
        if (lines == null || lines.isEmpty()) return null
        return clean(lines.joinToString("\n") { it.toString() }, 5000)
    }

    fun firstNonBlank(vararg values: CharSequence?): String? = values.firstNotNullOfOrNull { clean(it, 5000) }
}
