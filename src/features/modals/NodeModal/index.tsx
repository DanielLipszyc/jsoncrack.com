import React, { useState, useCallback } from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Helper function to update JSON at a specific path
const updateJsonAtPath = (json: string, path: NodeData["path"] | undefined, newValue: any): string => {
  try {
    const obj = JSON.parse(json);
    
    if (!path || path.length === 0) {
      // Root level - replace entire JSON
      return JSON.stringify(newValue, null, 2);
    }

    // Navigate to parent and update value
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = newValue;

    return JSON.stringify(obj, null, 2);
  } catch {
    return json;
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setJson = useJson(state => state.setJson);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const handleEdit = useCallback(() => {
    setEditedContent(normalizeNodeData(nodeData?.text ?? []));
    setIsEditing(true);
  }, [nodeData]);

  const handleSave = useCallback(() => {
    try {
      if (!nodeData) return;

      // Validate JSON
      const parsedContent = JSON.parse(editedContent);
      
      // Get current JSON
      const currentJson = useJson.getState().json;
      
      // Update JSON at the node's path
      const updatedJson = updateJsonAtPath(currentJson, nodeData.path, parsedContent);
      
      // Update both stores
      setJson(updatedJson);
      
      // Update the graph store with new node data
      const updatedNodes = useGraph.getState().nodes.map(node => {
        if (node.id === nodeData.id) {
          return {
            ...node,
            text: nodeData.text.map(row => ({
              ...row,
              value: row.key && parsedContent[row.key] !== undefined ? parsedContent[row.key] : row.value,
            })),
          };
        }
        return node;
      });
      const updatedSelectedNode: NodeData = {
        ...nodeData,
        text: nodeData.text.map(row => ({
          ...row,
          value: row.key && parsedContent[row.key] !== undefined ? parsedContent[row.key] : row.value,
        })),
      };
      useGraph.setState({ nodes: updatedNodes, selectedNode: updatedSelectedNode });

      setIsEditing(false);
    } catch (error) {
      console.error("Invalid JSON:", error);
    }
  }, [editedContent, nodeData, setJson]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedContent("");
  }, []);

  if (!nodeData) return null;

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>

          {isEditing ? (
            <>
              <Textarea
                value={editedContent}
                onChange={e => setEditedContent(e.currentTarget.value)}
                placeholder="Enter JSON content"
                minRows={6}
                maxRows={12}
                styles={{
                  input: {
                    fontFamily: "monospace",
                    fontSize: "12px",
                  },
                }}
              />
              <Group justify="flex-end" gap="xs">
                <Button variant="default" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} color="green">
                  Save
                </Button>
              </Group>
            </>
          ) : (
            <>
              <ScrollArea.Autosize mah={250} maw={600}>
                <CodeHighlight
                  code={normalizeNodeData(nodeData.text)}
                  miw={350}
                  maw={600}
                  language="json"
                  withCopyButton
                />
              </ScrollArea.Autosize>
              <Flex justify="flex-end">
                <Button onClick={handleEdit} color="blue">
                  Edit
                </Button>
              </Flex>
            </>
          )}
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
