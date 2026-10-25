export function itemLabel(item: { name: string; count: number }): string {
  return item.count > 1 ? `${item.name} x${item.count}` : item.name;
}

export function itemCountLabel(count: number): string {
  if (count === 0) {
    return "No items";
  }
  return count === 1 ? "1 item" : `${count} items`;
}
