# personal-website

A simple website that runs entirely on Cloudflare workers.

Features:

- Markdown support
- Redirects
- Entirely dynamically updated content (via `PUT` and `DELETE` requests)

## Setup

1. Update the wrangler.toml file to your needs.
2. Add the `AUTH_HEADER` secret using `npx wrangler secret put AUTH_HEADER`
3. Publish the worker using `npx wrangler publish`

## Configuration

### Updating the website

In order to update the website, you need to send a `PUT` request to the path you would like to update. For example, if I wanted to update the page that is at the path `/test`, I would send a `PUT` request to `https://example.com/test` (replace example.com with wherever your worker is) with the `authorization` header set to the value of the AUTH_HEADER secret.

The body of the request contains both the page contents and the configuration for that page. The configuration is stored entirely in a markdown table at the top.

```md
| key         | value                |
| ----------- | -------------------- |
| title       | Testing              |
| description | This is a test page. |

This is the body of the page.
```

This table is entirely optional (same with every row in it), but the title will be set to `???` if it is not included.

If you would like to have a custom `content-type` header for the page (and not include the header or render the body as markdown), set the key `custom_content_type` and the value to the `content-type` you would like to have. This is perfect for plain text pages.

The url for the image used in the meta tags can be set using the `meta_image` key.

### Getting raw pages

If you would like to update a page, instead of re-writing the entire page since it is processed, you can append `?raw` to any url to get the source as plain text. (Including the table with settings to configure the page). This can be direcetly copied into the body of the request you send to update a page. No authentication is needed to do this.

### Deleting pages

To delete a page, send a `DELETE` request to the page with the correct `authorization` header set. This will delete the page permanently.
