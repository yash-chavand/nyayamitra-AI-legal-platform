import { useRef, useEffect } from "react"

export default function RichTextEditor({ value, onChange }) {
    const editorRef = useRef(null)

    // Load plain text and convert to HTML
    useEffect(() => {
        if (editorRef.current) {
            const containsHtml = /<[a-z][\s\S]*>/i.test(value || "")
            const htmlValue = containsHtml ? (value || "") : (value || "").replace(/\n/g, "<br>")
            if (editorRef.current.innerHTML !== htmlValue) {
                editorRef.current.innerHTML = htmlValue
            }
        }
    }, [value])

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML)
        }
    }

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value)
        handleInput()
    }

    return (
        <div className="border border-border rounded-xl overflow-hidden bg-bg/50">
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-surfaceLight/80 flex-wrap">
                <button 
                    type="button" 
                    onClick={() => execCommand("bold")} 
                    className="px-2.5 py-1 rounded bg-surface hover:bg-border text-xs font-bold text-gray-300 hover:text-white"
                    title="Bold"
                >
                    B
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand("italic")} 
                    className="px-2.5 py-1 rounded bg-surface hover:bg-border text-xs italic text-gray-300 hover:text-white"
                    title="Italic"
                >
                    I
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand("underline")} 
                    className="px-2.5 py-1 rounded bg-surface hover:bg-border text-xs underline text-gray-300 hover:text-white"
                    title="Underline"
                >
                    U
                </button>
                <div className="w-px h-5 bg-border mx-1" />
                <button 
                    type="button" 
                    onClick={() => execCommand("justifyLeft")} 
                    className="px-2 py-1 rounded bg-surface hover:bg-border text-xs text-gray-300 hover:text-white"
                    title="Align Left"
                >
                    Left
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand("justifyCenter")} 
                    className="px-2 py-1 rounded bg-surface hover:bg-border text-xs text-gray-300 hover:text-white"
                    title="Align Center"
                >
                    Center
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand("justifyRight")} 
                    className="px-2 py-1 rounded bg-surface hover:bg-border text-xs text-gray-300 hover:text-white"
                    title="Align Right"
                >
                    Right
                </button>
            </div>
            
            {/* Editable Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto outline-none text-sm text-gray-200 leading-relaxed font-sans"
                style={{ whiteSpace: "pre-wrap" }}
            />
        </div>
    )
}
