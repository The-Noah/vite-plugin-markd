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
        .use(rehypeAutoLinkHeadings)
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
