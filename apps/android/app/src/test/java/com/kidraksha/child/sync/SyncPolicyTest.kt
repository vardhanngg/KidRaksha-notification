package com.kidraksha.child.sync

import org.junit.Assert.assertEquals
import org.junit.Test

class SyncPolicyTest {
    @Test fun successfulResponsesComplete() {
        assertEquals(SyncPolicy.Action.SUCCESS, SyncPolicy.forHttpStatus(200))
        assertEquals(SyncPolicy.Action.SUCCESS, SyncPolicy.forHttpStatus(201))
        assertEquals(SyncPolicy.Action.SUCCESS, SyncPolicy.forHttpStatus(204))
    }

    @Test fun transientResponsesRetry() {
        listOf(408, 425, 429, 500, 502, 503, 504).forEach {
            assertEquals(SyncPolicy.Action.RETRY, SyncPolicy.forHttpStatus(it))
        }
    }

    @Test fun authFailuresRevokeLocalCredentials() {
        assertEquals(SyncPolicy.Action.AUTH_REVOKED, SyncPolicy.forHttpStatus(401))
        assertEquals(SyncPolicy.Action.AUTH_REVOKED, SyncPolicy.forHttpStatus(403))
    }

    @Test fun sharingConflictStopsLocalSharing() {
        assertEquals(SyncPolicy.Action.SHARING_DISABLED, SyncPolicy.forHttpStatus(409))
    }

    @Test fun validationFailuresAreNotRetriedImmediately() {
        assertEquals(SyncPolicy.Action.TERMINAL, SyncPolicy.forHttpStatus(400))
        assertEquals(SyncPolicy.Action.TERMINAL, SyncPolicy.forHttpStatus(422))
        assertEquals(SyncPolicy.Action.TERMINAL, SyncPolicy.forHttpStatus(404))
    }
}
