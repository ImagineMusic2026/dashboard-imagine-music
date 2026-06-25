/** @type {import('next').NextConfig} */
const nextConfig = {
  // ssh2 (via ssh2-sftp-client) tem binário nativo; mantê-lo fora do bundle do
  // webpack evita quebrar no build/serverless. Usado pelo cron de streaming OneRPM.
  experimental: {
    serverComponentsExternalPackages: ['ssh2', 'ssh2-sftp-client'],
  },
};

export default nextConfig;
