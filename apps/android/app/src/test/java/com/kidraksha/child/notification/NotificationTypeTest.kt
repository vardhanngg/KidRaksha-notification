package com.kidraksha.child.notification

import android.app.Notification
import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationTypeTest {
    @Test fun mapsStandardAndroidCategories() {
        assertEquals(NotificationType.MESSAGE, NotificationType.fromCategory(Notification.CATEGORY_MESSAGE))
        assertEquals(NotificationType.MESSAGE, NotificationType.fromCategory(Notification.CATEGORY_SOCIAL))
        assertEquals(NotificationType.EMAIL, NotificationType.fromCategory(Notification.CATEGORY_EMAIL))
        assertEquals(NotificationType.CALL, NotificationType.fromCategory(Notification.CATEGORY_CALL))
        assertEquals(NotificationType.CALL, NotificationType.fromCategory(Notification.CATEGORY_MISSED_CALL))
        assertEquals(NotificationType.MEDIA, NotificationType.fromCategory(Notification.CATEGORY_TRANSPORT))
        assertEquals(NotificationType.ALARM, NotificationType.fromCategory(Notification.CATEGORY_ALARM))
        assertEquals(NotificationType.REMINDER, NotificationType.fromCategory(Notification.CATEGORY_REMINDER))
        assertEquals(NotificationType.EVENT, NotificationType.fromCategory(Notification.CATEGORY_EVENT))
        assertEquals(NotificationType.PROGRESS, NotificationType.fromCategory(Notification.CATEGORY_PROGRESS))
        assertEquals(NotificationType.SERVICE, NotificationType.fromCategory(Notification.CATEGORY_SERVICE))
        assertEquals(NotificationType.SYSTEM, NotificationType.fromCategory(Notification.CATEGORY_SYSTEM))
        assertEquals(NotificationType.SYSTEM, NotificationType.fromCategory(Notification.CATEGORY_STATUS))
    }

    @Test fun normalizesCategoryInput() {
        assertEquals(NotificationType.SYSTEM, NotificationType.fromCategory(" SYS "))
        assertEquals(NotificationType.MESSAGE, NotificationType.fromCategory("Social"))
    }

    @Test fun unknownOrBlankCategoriesBecomeOther() {
        assertEquals(NotificationType.OTHER, NotificationType.fromCategory("something_else"))
        assertEquals(NotificationType.OTHER, NotificationType.fromCategory(" "))
        assertEquals(NotificationType.OTHER, NotificationType.fromCategory(null))
    }
}
