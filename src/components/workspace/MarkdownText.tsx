import React from 'react';

interface MarkdownTextProps {
    content: string;
    className?: string;
}

export function MarkdownText({ content, className }: MarkdownTextProps) {
    // Basic markdown parser
    // 1. Split by lines
    const lines = content.split('\n');

    // Process lines to handle lists
    const processedElements: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];

    lines.forEach((line, index) => {
        // Handle List Items
        if (line.trim().startsWith('- ')) {
            const listContent = line.trim().substring(2);
            currentList.push(
                <li key={`list-${index}`} className="ml-4 list-disc pl-1">
                    <InlineMarkdown text={listContent} />
                </li>
            );
        } else {
            // Flush list if exists
            if (currentList.length > 0) {
                processedElements.push(
                    <ul key={`ul-${index}`} className="mb-2 space-y-1">
                        {currentList}
                    </ul>
                );
                currentList = [];
            }

            // Handle normal lines (paragraphs)
            // Empty lines might be spacing
            if (line.trim() === '') {
                processedElements.push(<br key={`br-${index}`} />);
            } else {
                processedElements.push(
                    <p key={`p-${index}`} className="mb-1 last:mb-0">
                        <InlineMarkdown text={line} />
                    </p>
                );
            }
        }
    });

    // Flush remaining list
    if (currentList.length > 0) {
        processedElements.push(
            <ul key={`ul-end`} className="mb-2 space-y-1">
                {currentList}
            </ul>
        );
    }

    return <div className={className}>{processedElements}</div>;
}

// Helper to parse **bold** and *italic* within a line
function InlineMarkdown({ text }: { text: string }) {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
                } else if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={i} className="italic">{part.slice(1, -1)}</em>;
                }
                return part;
            })}
        </>
    );
}
