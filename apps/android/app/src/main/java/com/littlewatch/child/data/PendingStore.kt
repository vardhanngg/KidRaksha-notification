package com.littlewatch.child.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class PendingStore(context: Context) : SQLiteOpenHelper(context, "littlewatch_queue.db", null, 2) {
    private val appContext = context.applicationContext

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE pending (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              client_id TEXT NOT NULL UNIQUE,
              package_name TEXT NOT NULL,
              app_name TEXT NOT NULL,
              title_enc TEXT,
              body_enc TEXT,
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
            db.query("pending", arrayOf("id", "title", "body"), null, null, null, null, null).use { c ->
                val idIndex = c.getColumnIndexOrThrow("id")
                val titleIndex = c.getColumnIndexOrThrow("title")
                val bodyIndex = c.getColumnIndexOrThrow("body")
                while (c.moveToNext()) {
                    val values = ContentValues().apply {
                        put("title_enc", secure.encryptText(c.getString(titleIndex)))
                        put("body_enc", secure.encryptText(c.getString(bodyIndex)))
                    }
                    db.update("pending", values, "id=?", arrayOf(c.getLong(idIndex).toString()))
                }
            }
            db.execSQL("ALTER TABLE pending DROP COLUMN title")
            db.execSQL("ALTER TABLE pending DROP COLUMN body")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_pending_id ON pending(id)")
        }
    }

    fun insertIfAbsent(item: QueuedNotification) {
        val secure = SecureStore(appContext)
        writableDatabase.insertWithOnConflict(
            "pending", null,
            ContentValues().apply {
                put("client_id", item.clientNotificationId)
                put("package_name", item.packageName)
                put("app_name", item.appName)
                put("title_enc", secure.encryptText(item.title))
                put("body_enc", secure.encryptText(item.body))
                put("posted_at", item.postedAt)
            },
            SQLiteDatabase.CONFLICT_IGNORE
        )
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
                    packageName = c.getString(c.getColumnIndexOrThrow("package_name")),
                    appName = c.getString(c.getColumnIndexOrThrow("app_name")),
                    title = secure.decryptText(c.getString(c.getColumnIndexOrThrow("title_enc"))),
                    body = secure.decryptText(c.getString(c.getColumnIndexOrThrow("body_enc"))),
                    postedAt = c.getLong(c.getColumnIndexOrThrow("posted_at"))
                )
            }
        }
        return result
    }

    fun clear() {
        writableDatabase.delete("pending", null, null)
    }

    fun trimTo(maxRows: Int = 5000) {
        writableDatabase.delete("pending", "id NOT IN (SELECT id FROM pending ORDER BY id DESC LIMIT ?)", arrayOf(maxRows.toString()))
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
