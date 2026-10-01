// Shared API client for browser requests.

window.createApiClient = function ({ toast, isLoggedIn, onSessionExpired }) {
    // Keep JSON parsing tolerant of unexpected server output.
    const safeParseJson = async (res) => {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        const a = text.indexOf('{'), b = text.lastIndexOf('}');
        if (a !== -1 && b > a) {
          try { return JSON.parse(text.substring(a, b + 1)); } catch (_) { /* bagsak */ }
        }
        console.error('Non-JSON response:', text);
        throw new Error('The server response was not JSON (check the Console / PHP error log).');
      }
    };

    // State-changing requests include the current CSRF token.
    let csrfToken = '';
    const refreshCsrf = async () => {
      try {
        const r = await fetch('backend/api/check_session.php');
        const d = await safeParseJson(r);
        if (d && d.csrf) csrfToken = d.csrf;
      } catch (_) { /* handled by the caller's request */ }
    };

    // Centralize request handling and user-facing errors here.
    const api = async (url, body = null, { silent = false } = {}, retried = false) => {
      try {
        if (body && !csrfToken) await refreshCsrf();
        const res = await fetch(url, body
          ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) }
          : undefined);
        const data = await safeParseJson(res);
        if (data && data.csrf) csrfToken = data.csrf;
        // Refresh an expired token once before returning an error.
        if (res.status === 403 && body && !retried && /security check/i.test(data.message || '')) {
          await refreshCsrf();
          return api(url, body, { silent }, true);
        }
        if (res.status === 401 && isLoggedIn()) {
          onSessionExpired(data);
          return data;
        }
        if (!silent && data.success === false) toast(data.message || 'Server error.', 'error');
        return data;
      } catch (e) {
        console.error(url, e);
        if (!silent) toast(e.message || 'Cannot reach the server.', 'error');
        return { success: false, message: e.message };
      }
    };

  return { api, refreshCsrf };
};
