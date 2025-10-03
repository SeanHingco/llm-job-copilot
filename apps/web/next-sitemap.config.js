/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://resume-bender.seanhing.co',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: ['/api/*', '/admin/*'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: ['/api/', '/admin/'] },
    ],
  },
};
