package com.kidsuraksha.child.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class PendingStore(context: Context) : SQLiteOpenHelper(context, "kidraksha_queue.db", null, 3) {
    private val appContext = context.applicationContext

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE pending (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              client_id TEXT NOT NULL UNIQUE,
              notification_key_hash TEXT,
              package_name TEXT NOT NULL,
              app_name TEXT NOT NULL,
              title_enc TEXT,
              body_enc TEXT,
              content_state TEXT NOT NULL DEFAULT 'unavailable',
              notification_type TEXT NOT NULL DEFAULT 'other',
              category TEXT,
              channel_id TEXT,
              group_key TEXT,
              is_ongoing INTEGER NOT NULL DEFAULT 0,
              is_clearable INTEGER NOT NULL DEFAULT 0,
              is_group_summary INTEGER NOT NULL DEFAULT 0,
              posted_at INTEGER NOT NULL
            )
        """.trimIndent())
        db.execSQL("CREATE INDEX idx_pending_id ON pending(id)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE pending ADD COLUMN title_enc TEXT")
            db.execSQL("ALTER TABLE pending ADD COLUMN body_enc TEXT")
            val secure = SecureStore(appContext)
            val titleIndex = runCatching { db.query("pending", arrayOf("id", "title", "body"), null, null, null, null, null) }.getOrNull()
            titleIndex?.use { c ->
                val idIndex = c.getColumnIndex("id")
                val title = c.getColumnIndex("title")
                val body = c.getColumnIndex("body")
                if (idIndex >= 0 && title >= 0 && body >= 0) {
                    while (c.moveToNext()) {
                        val values = ContentValues().apply {
                            put("title_enc", if (c.isNull(title)) null else secure.encryptText(c.getString(title)))
                            put("body_enc", if (c.isNull(body)) null else secure.encryptText(c.getString(body)))
                        }
                        db.update("pending", values, "id=?", arrayOf(c.getLong(idIndex).toString()))
                    }
                }
            }
            runCatching { db.execSQL("ALTER TABLE pending DROP COLUMN title") }
            runCatching { db.execSQL("ALTER TABLE pending DROP COLUMN body") }
        }
        if (oldVersion < 3) {
            db.execSQL("ALTER TABLE pending ADD COLUMN notification_key_hash TEXT")
            db.execSQL("UPDATE pending SET notification_key_hash=client_id WHERE notification_key_hash IS NULL")
            db.execSQL("ALTER TABLE pending ADD COLUMN content_state TEXT NOT NULL DEFAULT 'unavailable'")
            db.execSQL("ALTER TABLE pending ADD COLUMN notification_type TEXT NOT NULL DEFAULT 'other'")
            db.execSQL("ALTER TABLE pending ADD COLUMN category TEXT")
            db.execSQL("ALTER TABLE pending ADD COLUMN channel_id TEXT")
            db.execSQL("ALTER TABLE pending ADD COLUMN group_key TEXT")
            db.execSQL("ALTER TABLE pending ADD COLUMN is_ongoing INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE pending ADD COLUMN is_clearable INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE pending ADD COLUMN is_group_summary INTEGER NOT NULL DEFAULT 0")
        }
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_pending_id ON pending(id)")
    }

    fun insertIfAbsent(item: QueuedNotification): Boolean {
        val secure = SecureStore(appContext)
        val rowId = writableDatabase.insertWithOnConflict(
            "pending", null,
            ContentValues().apply {
                put("client_id", item.clientNotificationId)
                put("notification_key_hash", item.notificationKeyHash)
                put("package_name", item.packageName)
                put("app_name", item.appName)
                put("title_enc", secure.encryptText(item.title))
                put("body_enc", secure.encryptText(item.body))
                put("content_state", item.contentState)
                put("notification_type", item.notificationType)
                put("category", item.category)
                put("channel_id", item.channelId)
                put("group_key", item.groupKey)
                put("is_ongoing", if (item.isOngoing) 1 else 0)
                put("is_clearable", if (item.isClearable) 1 else 0)
                put("is_group_summary", if (item.isGroupSummary) 1 else 0)
                put("posted_at", item.postedAt)
            },
            SQLiteDatabase.CONFLICT_IGNORE
        )
        return rowId != -1L
    }

    fun take(limit: Int = 50): List<QueuedNotification> {
        val secure = SecureStore(appContext)
        val result = mutableListOf<QueuedNotification>()
        readableDatabase.query(
            "pending", null, null, null, null, null, "id ASC", limit.toString()
        ).use { c ->
            while (c.moveToNext()) {
                result += QueuedNotification(
                    id = c.getLong(c.getColumnIndexOrThrow("id")),
                    clientNotificationId = c.getString(c.getColumnIndexOrThrow("client_id")),
                    notificationKeyHash = c.getString(c.getColumnIndexOrThrow("notification_key_hash")),
                    packageName = c.getString(c.getColumnIndexOrThrow("package_name")),
                    appName = c.getString(c.getColumnIndexOrThrow("app_name")),
                    title = secure.decryptText(c.getString(c.getColumnIndexOrThrow("title_enc"))),
                    body = secure.decryptText(c.getString(c.getColumnIndexOrThrow("body_enc"))),
                    contentState = c.getString(c.getColumnIndexOrThrow("content_state")),
                    notificationType = c.getString(c.getColumnIndexOrThrow("notification_type")),
                    category = c.getString(c.getColumnIndexOrThrow("category")),
                    channelId = c.getString(c.getColumnIndexOrThrow("channel_id")),
                    groupKey = c.getString(c.getColumnIndexOrThrow("group_key")),
                    isOngoing = c.getInt(c.getColumnIndexOrThrow("is_ongoing")) != 0,
                    isClearable = c.getInt(c.getColumnIndexOrThrow("is_clearable")) != 0,
                    isGroupSummary = c.getInt(c.getColumnIndexOrThrow("is_group_summary")) != 0,
                    postedAt = c.getLong(c.getColumnIndexOrThrow("posted_at"))
                )
            }
        }
        return result
    }

    fun clear() { writableDatabase.delete("pending", null, null) }

    fun trimTo(maxRows: Int = 5000): Int {
        return writableDatabase.delete(
            "pending",
            "id NOT IN (SELECT id FROM pending ORDER BY id DESC LIMIT ?)",
            arrayOf(maxRows.toString())
        )
    }

    fun remove(ids: List<Long>) {
        if (ids.isEmpty()) return
        writableDatabase.beginTransaction()
        try {
            ids.forEach { writableDatabase.delete("pending", "id=?", arrayOf(it.toString())) }
            writableDatabase.setTransactionSuccessful()
        } finally { writableDatabase.endTransaction() }
    }

    fun count(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM pending", null).use {
        if (it.moveToFirst()) it.getInt(0) else 0
    }
}
