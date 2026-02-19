import tinycolor from 'tinycolor2'

function generateColorVariations(defaultColor: string) {
    const defaultColorObj = tinycolor(defaultColor)

    const darkColor = defaultColorObj.clone().darken(2)
    const baseLight = tinycolor('#ffffff')
    const lightColor = tinycolor
        .mix(baseLight, defaultColorObj.toHex(), 12)
        .toHexString()
    const mediumColor = defaultColorObj.clone().lighten(26)

    return {
        default: defaultColorObj.toHexString(),
        dark: darkColor.toHexString(),
        light: lightColor,
        medium: mediumColor.toHexString(),
    }
}

function generateSelectionColor(defaultColor: string) {
    const defaultColorObj = tinycolor(defaultColor)
    const lightColor = defaultColorObj.lighten(8)
    return lightColor.toHexString()
}

export function generateTheme({
    primaryColor,
    fullLogoUrl,
    favIconUrl,
    logoIconUrl,
    websiteName,
}: {
    primaryColor: string
    fullLogoUrl: string
    favIconUrl: string
    logoIconUrl: string
    websiteName: string
}) {
    return {
        websiteName,
        colors: {
            avatar: '#515151',
            'blue-link': '#1890ff',
            danger: '#f94949',
            primary: generateColorVariations(primaryColor),
            warn: {
                default: '#f78a3b',
                light: '#fff6e4',
                dark: '#cc8805',
            },
            success: {
                default: '#14ae5c',
                light: '#3cad71',
            },
            selection: generateSelectionColor(primaryColor),
        },
        logos: {
            fullLogoUrl,
            favIconUrl,
            logoIconUrl,
        },
    }
}

const opsynFullLogoDataUri = `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2563EB"/><stop offset="100%" stop-color="#1D4ED8"/></linearGradient></defs><g><rect x="4" y="4" width="32" height="32" rx="10" fill="url(#g)"/><circle cx="16" cy="16" r="4.5" fill="white" opacity="0.96"/><circle cx="24" cy="24" r="4.5" fill="white" opacity="0.9"/><path d="M18.5 21.5C19.6 22.6 21.1 23.3 22.8 23.3C24.1 23.3 25.3 22.9 26.3 22.2" fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/></g><g transform="translate(52,9)" fill="#1e293b"><path d="M0 11C0 4.9 3.9 0 9.8 0C15.7 0 19.6 4.9 19.6 11C19.6 17.1 15.7 22 9.8 22C3.9 22 0 17.1 0 11ZM4.2 11C4.2 15 6.5 17.7 9.8 17.7C13.1 17.7 15.4 15 15.4 11C15.4 7 13.1 4.3 9.8 4.3C6.5 4.3 4.2 7 4.2 11Z"/><path d="M25.4 1.2H29.5V8.1C30.6 6.5 32.2 5.7 34.3 5.7C38 5.7 40.5 8.4 40.5 12.6C40.5 16.8 38 19.5 34.3 19.5C32.2 19.5 30.6 18.7 29.5 17.1V19.1H25.4V1.2ZM32.9 9.4C30.8 9.4 29.3 11 29.3 13.4C29.3 15.8 30.8 17.4 32.9 17.4C35 17.4 36.4 15.8 36.4 13.4C36.4 11 35 9.4 32.9 9.4Z"/><path d="M47.3 19.7C43.9 19.7 41.4 17.9 40.9 15.1L44.8 14.3C45.1 15.7 46.1 16.5 47.6 16.5C49 16.5 49.8 15.9 49.8 15.1C49.8 14.5 49.4 14.1 48.3 13.8L45.8 13.2C42.8 12.5 41.3 10.8 41.3 8.3C41.3 5 43.8 2.9 47.3 2.9C50.6 2.9 52.9 4.7 53.5 7.3L49.7 8.1C49.4 6.9 48.6 6.2 47.2 6.2C46.1 6.2 45.4 6.7 45.4 7.5C45.4 8.1 45.8 8.5 46.9 8.8L49.3 9.3C52.4 10 53.9 11.6 53.9 14.2C53.9 17.6 51.3 19.7 47.3 19.7Z"/><path d="M58.8 5.9H62.9L65 12.9L67.1 5.9H71.2L66.9 18.9C65.5 22.8 63.8 24.4 61 24.4C59.7 24.4 58.5 24.2 57.5 23.7L58.3 20.5C58.9 20.8 59.5 21 60.2 21C61.1 21 61.8 20.6 62.3 19.4L62.5 18.9L58.8 5.9Z"/><path d="M75.1 5.9H79.2V12.7C79.2 14.5 80.2 15.5 81.7 15.5C83.2 15.5 84.2 14.5 84.2 12.7V5.9H88.4V13C88.4 17 86 19.5 82.4 19.5C78.8 19.5 75.1 17.1 75.1 13V5.9Z"/></g></svg>')}`

const opsynIconDataUri = `data:image/svg+xml,${encodeURIComponent('<svg width="64" height="64" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2563EB"/><stop offset="100%" stop-color="#1D4ED8"/></linearGradient></defs><rect x="4" y="4" width="32" height="32" rx="10" fill="url(#g)"/><circle cx="16" cy="16" r="4.5" fill="#FFFFFF" fill-opacity="0.96"/><circle cx="24" cy="24" r="4.5" fill="#FFFFFF" fill-opacity="0.9"/><path d="M18.5 21.5C19.6 22.6 21.1 23.3 22.8 23.3C24.1 23.3 25.3 22.9 26.3 22.2" fill="none" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.95"/></svg>')}`

export const defaultTheme = generateTheme({
    primaryColor: '#2563EB',
    websiteName: 'OpSyn',
    fullLogoUrl: opsynFullLogoDataUri,
    favIconUrl: opsynIconDataUri,
    logoIconUrl: opsynIconDataUri,
})
