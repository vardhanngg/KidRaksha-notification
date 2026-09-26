package com.kidraksha.child.sync

/**
 * Maps HTTP outcomes to the action the persistent sync worker should take.
 * Keeping this pure makes retry behavior deterministic and unit-testable.
 */
object SyncPolicy {
    enum class Action {
        SUCCESS,
        RETRY,
        AUTH_REVOKED,
        SHARING_DISABLED,
        TERMINAL
    }

    fun forHttpStatus(code: Int): Action = when {
        code in 200..299 -> Action.SUCCESS
        code == 401 || code == 403 -> Action.AUTH_REVOKED
        code == 409 -> Action.SHARING_DISABLED
        code == 408 || code == 425 || code == 429 || code in 500..599 -> Action.RETRY
        else -> Action.TERMINAL
    }
}
