import MarkdownIt from 'markdown-it';
import { createMarkdownObjectTable } from 'parse-markdown-table';

export interface Env {
  PERSONAL_WEBSITE_PRD: KVNamespace;
  AUTH_HEADER: string;
}

const markdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

markdownIt.linkify.set({ fuzzyEmail: false });

let pageTemplate = `<!DOCTYPE html>
<html lang="en-US">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta property="og:type" content="website" />
		<meta property="og:locale" content="en-US" />
		<meta property="og:url" content="{__PAGE_URL}" />
		<meta property="og:site_name" content="{__PAGE_META_SITE_NAME}" />
		<meta property="twitter:card" content="summary_large_image" />
		{__PAGE_META_TITLE}
		{__PAGE_META_DESCRIPTION}
		{__PAGE_META_IMAGE}
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.1.0/github-markdown.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
		<style>
			html, body {
				width: 100%;
				height: 100%;
				margin: 0;
				padding: 0;
				background-color: #ffffff;
			}
			.markdown-body {
				box-sizing: border-box;
				min-width: 200px;
				max-width: 980px;
				margin: 0 auto;
				padding: 45px;
			}
			@media (prefers-color-scheme: dark) {
				html, body {
					background-color: #0d1117;
				}
			}
			@media (max-width: 767px) {
				.markdown-body {
					padding: 15px;
				}
			}
		</style>
	</head>
	<body>
		<div class="markdown-body">
		{__PAGE_HEADER}
		{__PAGE_CONTENTS}
		</div>
	</body>
</html>`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.toLowerCase();
    // Get page
    if (request.method === 'GET') {
      if (pathname === '/__routes') {
        if (request.headers.get('authorization') !== env.AUTH_HEADER) {
          return new Response('403: Forbidden', {
            status: 403,
            headers: {
              'content-type': 'text/plain',
            },
          });
        }
        const pathNames = await env.PERSONAL_WEBSITE_PRD.list();
        return new Response(JSON.stringify(pathNames.keys.map((value) => value.name).filter((value) => value.startsWith('/'))), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }
      const headerValue = (await env.PERSONAL_WEBSITE_PRD.get('/__header')) || 'None';
      const pageMetaSiteName = (await env.PERSONAL_WEBSITE_PRD.get('/__site_name')) || '???';
      let status = 200;
      let pageValue = await env.PERSONAL_WEBSITE_PRD.get(pathname);
      // If the page was not found or if the page url starts with two underscores
      if (pageValue === null || (pathname.startsWith('/__') && !url.searchParams.has('raw'))) {
        status = 404;
        pageValue = [
          '| key         | value          |',
          '| ----------- | -------------- |',
          '| title       | Not Found      |',
          '| description | Page Not Found |',
          '',
          '# Page Not Found',
          'The page requested was not found.',
        ].join('\n');
      }
      pageValue = pageValue.replace(/\n\r?/g, '\n');
      if (url.searchParams.has('raw')) {
        return new Response(pageValue, {
          status,
          headers: {
            'content-type': 'text/plain',
          },
        });
      }
      // Get the table with settings from the markdown
      let settings: { [key: string]: string } = {};
      const pageValueSplit = pageValue.trim().split('\n\n');
      const tableLines = [];
      for (let i = 0; i < pageValueSplit.length; i++) {
        if (!pageValueSplit[i].trim().endsWith('|')) {
          break;
        }
        tableLines.push(pageValueSplit[i]);
      }
      if (pageValue.trim().startsWith('|')) {
        const pageSettingsTable = pageValueSplit[0];
        // Check if the table is valid
        if (pageSettingsTable.trim().endsWith('|')) {
          const pageSettingsTableParsed = await createMarkdownObjectTable(pageSettingsTable);
          for await (const row of pageSettingsTableParsed) {
            settings[row.key || '__invalid_key'] = row.value || '__invalid_value';
          }
          pageValueSplit.shift();
        }
      }
      // If we have a redirect set in the settings, use that
      if (settings.redirect_url && settings.redirect_url.startsWith('http')) {
        return Response.redirect(settings.redirect_url, 302);
      }
      // Get just the contents of the page (without the settings table)
      const pageContents = pageValueSplit.join('\n\n');
      // Show plain text response (if plain_text is true)
      if (settings.custom_content_type) {
        return new Response(pageContents, {
          status,
          headers: {
            'content-type': settings.custom_content_type,
          },
        });
      }
      const pageUrl = url.href;
      // Page title
      const pageMetaTitle = [
        `<title>${settings.title || '???'} - ${pageMetaSiteName}</title>`,
        `<meta property="og:title" content="${settings.title || '???'}"/>`,
      ].join('\n');
      // Page description
      const pageMetaDescription = !settings.description
        ? ''
        : [
            `<meta property="og:description" content="${settings.description}"/>`,
            `<meta property="description" content="${settings.description}"/>`,
          ].join('\n');
      // Page meta tags image
      const pageMetaImage = !settings.meta_image
        ? ''
        : [
            `<meta property="og:image" content="${settings.meta_image}"/>`,
            `<meta property="twitter:image" content="${settings.meta_image}"/>`,
          ].join('\n');
      const renderedHeader = markdownIt.render(headerValue);
      const renderedContents = markdownIt.render(pageContents);
      const matchedStyle = pageTemplate.match(/<style>(.*)<\/style>/gms);
      if (matchedStyle) {
        const cssOutput = matchedStyle[0].replace('\n', '').replace(/(\s{2,})/g, '');
        pageTemplate = pageTemplate.replace(/<style>.*<\/style>/gms, `${cssOutput}`);
      }
      return new Response(
        pageTemplate
          .replace('{__PAGE_URL}', pageUrl)
          .replace('{__PAGE_META_SITE_NAME}', pageMetaSiteName)
          .replace('{__PAGE_META_TITLE}', pageMetaTitle)
          .replace('{__PAGE_META_DESCRIPTION}', pageMetaDescription)
          .replace('{__PAGE_META_IMAGE}', pageMetaImage)
          .replace('{__PAGE_HEADER}', renderedHeader)
          .replace('{__PAGE_CONTENTS}', renderedContents)
          // Minify the html (pretty much every lib for this requires node modules, but this works)
          .split(/>[\s]*</g)
          .join('><'),
        {
          status,
          headers: {
            'content-type': 'text/html',
          },
        }
      );
    }
    // Create/update page
    if (request.method === 'PUT') {
      if (request.headers.get('authorization') !== env.AUTH_HEADER) {
        return new Response('403: Forbidden', {
          status: 403,
          headers: {
            'content-type': 'text/plain',
          },
        });
      }
      const pageBody = (await request.text()) || '';
      await env.PERSONAL_WEBSITE_PRD.put(pathname, pageBody);
      return new Response('Page updated.', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      });
    }
    // Delete page
    if (request.method === 'DELETE') {
      if (request.headers.get('authorization') !== env.AUTH_HEADER) {
        return new Response('403: Forbidden', {
          status: 403,
          headers: {
            'content-type': 'text/plain',
          },
        });
      }
      await env.PERSONAL_WEBSITE_PRD.delete(pathname);
      return new Response('', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      });
    }
    return new Response('405: Method Not Allowed', {
      status: 405,
      headers: {
        'content-type': 'text/plain',
      },
    });
  },
};
