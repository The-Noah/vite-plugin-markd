/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import type {Plugin} from "vite";
import {unified} from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import remarkSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import rehypeSlug from "rehype-slug";
import rehypeAutoLinkHeadings from "rehype-autolink-headings";

export interface Options {
  extensions: string[];
}

const DEFAULT_OPTIONS: Options = {
  extensions: [".md"],
};

function VitePluginMarkdown(inlineOptions?: Partial<Options>): Plugin {
  const options: Options = {
    ...DEFAULT_OPTIONS,
    ...inlineOptions,
  };

  return {
    name: "vite-plugin-markd",
    enforce: "pre",
    async transform(content, file) {
      if (!options.extensions.includes(file.split(".").pop() ?? "")) {
        return;
      }

      const markdown = await unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ["yaml"])
        .use(remarkGfm)
        .use(remarkRehype)
        .use(remarkSanitize)
        .use(rehypeStringify)
        .use(rehypeSlug)
        .use(() => (tree, vFile) => {
          for (const node of tree.children) {
            if (node.type === "element" && node.tagName === "h1") {
              delete node.properties.id;
              vFile.data.title = node.children.find((child) => child.type === "text")?.value;
            }
          }
        })
        .use(rehypeAutoLinkHeadings, {
          content: {
            type: "element",
            tagName: "svg",
            properties: {
              viewBox: "0 0 16 16",
              xmlns: "http://www.w3.org/2000/svg",
              width: "16",
              height: "16",
              fill: "currentColor",
            },
            children: [
              {
                type: "element",
                tagName: "path",
                properties: {
                  fillRule: "evenodd",
                  clipRule: "evenodd",
                  d: "m2.475 10.646 2.121-2.12a.5.5 0 0 1 .707 0 .25.25 0 0 0 .354 0l.707-.708a.25.25 0 0 0 0-.354 2 2 0 0 0-2.828 0L1.414 9.586a2 2 0 0 0 0 2.828l2.122 2.122a2 2 0 0 0 2.828 0l2.121-2.122a2 2 0 0 0 0-2.828.25.25 0 0 0-.353 0l-.707.707a.25.25 0 0 0 0 .353.5.5 0 0 1 0 .708l-2.122 2.12a.5.5 0 0 1-.707 0l-2.121-2.12a.5.5 0 0 1 0-.708ZM9.192 8.88a.25.25 0 0 1 0-.354l.707-.707a.25.25 0 0 1 .354 0 .5.5 0 0 0 .707 0l2.121-2.121a.5.5 0 0 0 0-.707l-2.12-2.122a.5.5 0 0 0-.708 0L8.132 4.99a.5.5 0 0 0 0 .707.25.25 0 0 1 0 .353l-.707.707a.25.25 0 0 1-.354 0 2 2 0 0 1 0-2.828l2.121-2.121a2 2 0 0 1 2.829 0l2.121 2.12a2 2 0 0 1 0 2.83l-2.121 2.12a2 2 0 0 1-2.829 0Zm-3.535.353a.75.75 0 0 0 1.06 1.06L9.9 7.112a.75.75 0 1 0-1.06-1.06L5.657 9.231Z",
                },
              },
            ],
          },
        })
        .use(() => (tree, vFile) => {
          vFile.data.toc = [];

          for (const node of tree.children) {
            if (node.type === "element" && ["h2", "h3", "h4", "h5", "h6"].includes(node.tagName)) {
              vFile.data.toc.push({
                level: +node.tagName.slice(1) - 1,
                content: node.children.find((child) => child.type === "text")?.value,
                id: node.properties?.id,
              });
            } else if (node.type === "yaml") {
              vFile.data.frontmatter = node.value;
            }

            if (node.children) {
              recurseTree(node, (child) => {
                if (
                  child.type === "element" &&
                  child.tagName === "a" &&
                  !child.properties.href.startsWith("#") &&
                  !child.properties.href.startsWith("mailto:") &&
                  !child.properties.href.startsWith("/docs")
                ) {
                  child.properties.target = "_blank";
                  child.properties.rel = "noopener";
                }
              });
            }
          }
        })
        .process(content);

      const html = markdown.toString();

      let code = "";

      code += `export const html = ${JSON.stringify(html)};`;
      code += `export const toc = ${JSON.stringify(markdown.data.toc)};`;
      code += `export const frontmatter = ${JSON.stringify(markdown.data.frontmatter)};`;
      code += `export const title = ${JSON.stringify(markdown.data.title)};`;

      return code;
    },
  };
}

function recurseTree(
  tree: {
    children: any[];
  },
  callback: (node: {children?: any[]}) => void
) {
  for (const node of tree.children) {
    if (node.children) {
      recurseTree(node, callback);
    }

    callback(node);
  }
}

export default VitePluginMarkdown;
