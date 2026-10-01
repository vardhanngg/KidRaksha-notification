package com.kidsuraksha.child.sync

import kotlinx.coroutines.sync.Mutex

/** Prevents periodic and immediate sync workers in the same app process from racing. */
object SyncGate {
    private val mutex = Mutex()

    suspend fun <T> withLock(block: suspend () -> T): T {
        mutex.lock()
        return try {
            block()
        } finally {
            mutex.unlock()
        }
    }
}
