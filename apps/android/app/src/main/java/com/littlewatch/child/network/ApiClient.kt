
package com.littlewatch.child.network

import com.littlewatch.child.data.QueuedNotification
import com.littlewatch.child.data.Prefs
import com.littlewatch.child.data.SecureStore
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(private val prefs: Prefs, private val secure: SecureStore) {
    data class PairResult(val deviceId: String, val token: String)
    class ApiException(val code: Int, message: String): Exception(message)

    fun pair(code: String, name: String, appVersion: String): PairResult {
        val body = JSONObject()
            .put("code", code)
            .put("name", name)
            .put("appVersion", appVersion)
        val json = request("POST", "/device/pair", body)
        return PairResult(json.getString("deviceId"), json.getString("deviceToken"))
    }

    fun heartbeat() {
        authRequest(
            "POST", "/device/heartbeat",
            JSONObject()
                .put("appVersion", android.os.Build.VERSION.RELEASE)
                .put("sharingEnabled", prefs.sharingEnabled)
                .put("contentSharingEnabled", prefs.contentSharingEnabled)
        )
    }

    fun upload(items: List<QueuedNotification>): Int {
        val list = JSONArray()
        items.forEach { n ->
            list.put(JSONObject()
                .put("clientNotificationId", n.clientNotificationId)
                .put("packageName", n.packageName)
                .put("appName", n.appName)
                .putOpt("title", n.title)
                .putOpt("body", n.body)
                .put("postedAt", java.time.Instant.ofEpochMilli(n.postedAt).toString()))
        }
        val result = authRequest("POST", "/device/notifications", JSONObject().put("notifications", list))
        return result.optInt("accepted", 0)
    }

    fun unpair() {
        runCatching { authRequest("POST", "/device/unpair", JSONObject()) }
    }

    private fun authRequest(method: String, path: String, body: JSONObject): JSONObject {
        val token = secure.getToken() ?: throw ApiException(401, "No device token")
        return request(method, path, body, token)
    }

    private fun request(method: String, path: String, body: JSONObject, token: String? = null): JSONObject {
        val url = URL(prefs.serverUrl + path)
        if (!BuildConfig.DEBUG && !url.protocol.equals("https", ignoreCase = true)) {
            throw ApiException(0, "Secure HTTPS connection required")
        }
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10000
            readTimeout = 15000
            doInput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("X-LittleWatch-Client", "android")
            token?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        val raw = body.toString().toByteArray(Charsets.UTF_8)
        connection.doOutput = true
        connection.outputStream.use { it.write(raw) }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
        if (code !in 200..299) throw ApiException(code, json.optString("error", "Request failed"))
        return json
    }
}
