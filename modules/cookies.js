

function parseCookieHeader(cookieHeader) {
    return cookieHeader.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.split('=')
        acc[name.trim()] = value
        return acc
    }, {})
}

function serializeCookieHeader(name, value, options) {
    const parts = [`${name}=${value}`]

    if (options) {
        if (options.maxAge) {
            parts.push(`Max-Age=${options.maxAge}`)
        }

        if (options.expires) {
            parts.push(`Expires=${options.expires.toUTCString()}`)
        }

        if (options.path) {
            parts.push(`Path=${options.path}`)
        }

        if (options.domain) {
            parts.push(`Domain=${options.domain}`)
        }

        if (options.secure) {
            parts.push('Secure')
        }

        if (options.httpOnly) {
            parts.push('HttpOnly')
        }

        if (options.sameSite) {
            parts.push(`SameSite=${options.sameSite}`)
        }
    }

    return parts.join('; ')
}