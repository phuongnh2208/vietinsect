// Duyệt cây taxonomy thành danh sách phẳng, giữ độ sâu để hiển thị thụt lề trong <select>.
export function flattenTree(nodes, depth = 0, acc = []) {
  nodes.forEach((node) => {
    acc.push({ ...node, depth });
    if (node.children?.length) flattenTree(node.children, depth + 1, acc);
  });
  return acc;
}
