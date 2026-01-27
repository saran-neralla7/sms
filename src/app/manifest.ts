import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'GVP Student Management System',
        short_name: 'GVP SMS',
        description: 'Attendance Management System for GVP',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0070f3',
        icons: [
            {
                src: '/gvp-logo.jpg',
                sizes: 'any',
                type: 'image/jpeg',
            },
        ],
    };
}
