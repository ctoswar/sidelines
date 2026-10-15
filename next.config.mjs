/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Docker build sets NEXT_OUTPUT_STANDALONE=1 to produce the
  // self-contained .next/standalone bundle. Local builds keep the default
  // output so `next start` (and the verify harnesses) work unchanged.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1"
    ? { output: "standalone" }
    : {}),
};
export default nextConfig;
