package com.kidraksha.child.notification

import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationTypeTest {
    @Test fun mapsCommonAndroidCategories() {
        assertEquals(NotificationType.MESSAGE, NotificationType.fromCategory("msg"))
        assertEquals(NotificationType.EMAIL, NotificationType.fromCategory("email"))
        assertEquals(NotificationType.CALL, NotificationType.fromCategory("call"))
        assertEquals(NotificationType.MEDIA, NotificationType.fromCategory("transport"))
        assertEquals(NotificationType.SYSTEM, NotificationType.fromCategory("sys"))
        assertEquals(NotificationType.OTHER, NotificationType.fromCategory("something_else"))
    }
}
