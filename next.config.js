/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // <-- enables static export
  distDir: 'out',   // optional, folder for the build output
}

module.exports = nextConfig
