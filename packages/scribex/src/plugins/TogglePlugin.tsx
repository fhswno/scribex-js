"use client";

import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $findMatchingParent,
  mergeRegister,
} from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
} from "lexical";

import { INSERT_TOGGLE_COMMAND } from "../commands";
import {
  $createToggleContainerNode,
  $isToggleContainerNode,
  ToggleContainerNode,
} from "../nodes/ToggleContainerNode";
import {
  $createToggleTitleNode,
  $isToggleTitleNode,
  ToggleTitleNode,
} from "../nodes/ToggleTitleNode";
import {
  $createToggleContentNode,
  $isToggleContentNode,
  ToggleContentNode,
} from "../nodes/ToggleContentNode";

export function TogglePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const $onEscapeUp = () => {
      const selection = $getSelection();
      if (
        $isRangeSelection(selection) &&
        selection.isCollapsed() &&
        selection.anchor.offset === 0
      ) {
        const container = $findMatchingParent(
          selection.anchor.getNode(),
          $isToggleContainerNode,
        );
        if ($isToggleContainerNode(container)) {
          const parent = container.getParent();
          if (
            parent !== null &&
            parent.getFirstChild() === container &&
            selection.anchor.key ===
              container.getFirstDescendant()?.getKey()
          ) {
            container.insertBefore($createParagraphNode());
          }
        }
      }
      return false;
    };

    const $onEscapeDown = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && selection.isCollapsed()) {
        const container = $findMatchingParent(
          selection.anchor.getNode(),
          $isToggleContainerNode,
        );
        if ($isToggleContainerNode(container)) {
          const parent = container.getParent();
          if (parent !== null && parent.getLastChild() === container) {
            const lastDescendant = container.getLastDescendant();
            if (
              lastDescendant !== null &&
              selection.anchor.key === lastDescendant.getKey() &&
              selection.anchor.offset ===
                lastDescendant.getTextContentSize()
            ) {
              container.insertAfter($createParagraphNode());
            }
          }
        }
      }
      return false;
    };

    return mergeRegister(
      // ContentNode must live inside a ContainerNode
      editor.registerNodeTransform(ToggleContentNode, (node) => {
        const parent = node.getParent();
        if (!$isToggleContainerNode(parent)) {
          const children = node.getChildren();
          for (const child of children) {
            node.insertBefore(child);
          }
          node.remove();
        }
      }),

      // TitleNode must live inside a ContainerNode
      editor.registerNodeTransform(ToggleTitleNode, (node) => {
        const parent = node.getParent();
        if (!$isToggleContainerNode(parent)) {
          node.replace(
            $createParagraphNode().append(...node.getChildren()),
          );
        }
      }),

      // ContainerNode must have exactly [TitleNode, ContentNode]
      editor.registerNodeTransform(ToggleContainerNode, (node) => {
        const children = node.getChildren();
        if (
          children.length !== 2 ||
          !$isToggleTitleNode(children[0]) ||
          !$isToggleContentNode(children[1])
        ) {
          // Structure is broken — unwrap everything out
          for (const child of children) {
            node.insertBefore(child);
          }
          node.remove();
        }
      }),

      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        $onEscapeDown,
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_RIGHT_COMMAND,
        $onEscapeDown,
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        $onEscapeUp,
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        $onEscapeUp,
        COMMAND_PRIORITY_LOW,
      ),

      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;

          const titleNode = $findMatchingParent(
            selection.anchor.getNode(),
            $isToggleTitleNode,
          );
          if (!$isToggleTitleNode(titleNode)) return false;

          const container = titleNode.getParent();
          if (!$isToggleContainerNode(container)) return false;

          // If closed, open it first
          if (!container.getOpen()) {
            container.toggleOpen();
          }

          // Focus the content node
          const content = titleNode.getNextSibling();
          if ($isToggleContentNode(content)) {
            const firstChild = content.getFirstChild();
            if (firstChild && "selectEnd" in firstChild) {
              (
                firstChild as import("lexical").ElementNode
              ).selectEnd();
            } else {
              content.selectEnd();
            }
          }

          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      editor.registerCommand(
        INSERT_TOGGLE_COMMAND,
        (payload) => {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            const title = $createToggleTitleNode();
            const content = $createToggleContentNode();
            const innerParagraph = $createParagraphNode();
            content.append(innerParagraph);

            const container = $createToggleContainerNode({
              open: payload?.isOpen ?? true,
            });
            container.append(title, content);

            // Find the top-level block at the selection
            const anchor = selection.anchor.getNode();
            let topBlock = anchor;
            while (
              topBlock.getParent() &&
              !$isRootNode(topBlock.getParent())
            ) {
              topBlock = topBlock.getParent()!;
            }

            // Replace the current block if it's empty, otherwise insert after
            if (
              $isElementNode(topBlock) &&
              topBlock.getTextContent().trim() === ""
            ) {
              topBlock.replace(container);
            } else {
              topBlock.insertAfter(container);
            }

            title.selectEnd();
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  return null;
}
