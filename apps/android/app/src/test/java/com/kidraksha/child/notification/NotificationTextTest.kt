package com.kidsuraksha.child.notification

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationTextTest {
    @Test fun cleansWhitespaceAndControlCharacters() {
        assertEquals(
            "Hello world\n\nAgain",
            NotificationText.clean("  Hello\u0000  world\n\n\nAgain  ", 500)
        )
    }

    @Test fun normalizesLineEndingsAndLineWhitespace() {
        assertEquals(
            "One\nTwo\nThree",
            NotificationText.clean("  One  \r\n\tTwo\r\nThree  ", 500)
        )
    }

    @Test fun joinsNotificationLines() {
        assertEquals("One\nTwo\nThree", NotificationText.joinLines(arrayOf("One", "Two", "Three")))
    }

    @Test fun blankTextBecomesNull() {
        assertNull(NotificationText.clean(" \t\n ", 100))
    }

    @Test fun nonPositiveLimitBecomesNull() {
        assertNull(NotificationText.clean("Hello", 0))
        assertNull(NotificationText.clean("Hello", -1))
    }
}
