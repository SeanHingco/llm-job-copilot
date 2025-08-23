"use client"
import {useState} from "react";


export default function DraftPage() {
    const[url, setUrl] = useState<string>("");
    const[q, setQ] = useState<string>("");
    const[jobTitle, setJobTitle] = useState<string>("");
    const[resumeText, setResumeText] = useState("");
    const[resumeFile, setResumeFile] = useState<File | null>(null);
    const[status, setStatus] = useState<string>("");
    const[error, setError] = useState<string>("");
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [probablyScanned, setProbablyScanned] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [bullets, setBullets] = useState<string>("");
    const [genError, setGenError] = useState<string>("");
    const inputBase = "w-full rounded-lg border border-slate-300 bg-black px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
    const labelBase = "text-sm text-neutral-800 font-medium";

    const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

    async function onExtract() {
        setError(""); setStatus(""); setProbablyScanned(false);
        if (!resumeFile) {
            setError("Select a .pdf or .txt first.");
            return;
        }
        setIsExtracting(true);
        try {
            const fd = new FormData();
            fd.append("file", resumeFile);

            const res = await fetch(`${API}/resume/extract`, {
                method: 'POST',
                body: fd
            });

            if (!res.ok) {
                const body = await res.text().catch(() => "");
                setError(body || `Extract failed (${res.status})`);
                return;
            }

            const json = await res.json();
            setResumeText(json.text ?? "");
            setStatus(`Extracted • ${json.text_length ?? 0} chars`);
            setProbablyScanned(Boolean(json.probably_scanned));
        } catch (e: any){
            setError(e?.message || "Network error");
        } finally {
            setIsExtracting(false);
        }
    };

    async function onGenerate() {
        setGenError(""); setBullets("");

        if (!url) {
            setGenError("Enter a job URL first.");
            return;
        }

        setIsGenerating(true);
        try {
            const body = {
                url,
                q: q || null,
                job_title: jobTitle || null,
                resume: resumeText || ""
            }

            const res = await fetch(`${API}/draft/run`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                let msg = `Generate failed (${res.status})`;
                try {
                    const err = await res.json();
                    msg = err.detail || msg;
                } catch {}
                setGenError(msg);
                return;
            }

            const json = await res.json();
            setBullets(json.bullets ?? "");
        } catch (e: any){
            setGenError(e?.message || "Network error");
        } finally {
            setIsGenerating(false);
        }
    }

    async function onGenerateAll() {
        setError(""); setBullets(""); setGenError("");

        if (!url) {
            setGenError("Enter a job URL first.");
            return;
        }

        setIsGenerating(true);
        try {
            const fd = new FormData();
            fd.append("url", url);
            if (q) {fd.append("q", q);};
            if (jobTitle) {fd.append("job_title", jobTitle);};
            
            if (resumeFile) {fd.append("resume_file", resumeFile);}
            else if (resumeText) {fd.append("resume", resumeText);};

            const res = await fetch(`${API}/draft/run-form`, {
                method: 'POST',
                body: fd
            })

            if (!res.ok) {
                let msg = `Generate failed (${res.status})`;
                try {
                    const err = await res.json();
                    msg = err.detail || msg;
                } catch {}
                setGenError(msg);
                return;
            }

            const json = await res.json();
            setBullets(json.bullets ?? "");
        } catch (e: any) {
            setGenError(e?.message || "Network error");
        } finally {
            setIsGenerating(false);
        }
        
    }

    return (
        <main className="p-8 space-y-4">
            <div className="max-w-3xl mx-auto px-4">
                <h1 className="text-2xl font-bold">Get Resume Recs</h1>
                <div className="bg-white border rounded-2xl shadow-sm p-6">
                    <form className="grid gap-2" onSubmit={(e) => e.preventDefault()}>
                        <label htmlFor="url" className={labelBase}>Job URL</label>
                        <input
                            id="url"
                            name="url"
                            type="url"
                            placeholder='https://www.example.com'
                            className={inputBase}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                        />

                        <label htmlFor="q" className={labelBase}>Query (optional)</label>
                        <input
                            id="q"
                            name="q"
                            type="text"
                            placeholder='What are you looking for? e.g. "requirements responsibilities"'
                            className={inputBase}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />

                        <label htmlFor="job_title" className={labelBase}>Job title (optional)</label>
                        <input
                            id="jobTitle"
                            name="job_title"
                            type="text"
                            placeholder='Job title'
                            className={inputBase}
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                        />

                        <label htmlFor="resume" className={labelBase}>Resume text (optional)</label>
                        <textarea
                            id="resume"
                            name="resume"
                            placeholder="Resume"
                            rows={6}
                            className={inputBase}
                            value={resumeText}
                            onChange={(e) => setResumeText(e.target.value)}
                        >
                        </textarea>

                        <label htmlFor="resume_file" className={labelBase}>Resume file (PDF/TXT)</label>
                        <input
                            id="resumeFile"
                            name="resume_file"
                            type="file"
                            accept=".pdf,.txt" 
                            placeholder="Upload Resume File"
                            className="block w-full text-neutral-800 text-sm file:cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 hover:file:bg-slate-200"
                            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                        />
                        {/* {resumeFile && <small>Selected: {resumeFile.name}</small>} */}

                        {/* Submit */}
                        {/* <button type="button" onClick={onExtract} disabled={!resumeFile}>
                            Extract Resume Text
                        </button>
                        <button type="button" onClick={onGenerate} disabled={isGenerating || !url}>
                            Get Bullets
                        </button> */}
                        <button 
                            type="button" 
                            onClick={onGenerateAll}
                            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isGenerating || !url}>
                            {isGenerating ? "Generating…" : "Get Resume Insights"}
                        </button>
                    </form>
                </div>
                {error && <p style={{color:'crimson'}}>{error}</p>}
                {status && <p>{status}</p>}
                {bullets && (
                <div className="mt-6">
                    <h2 className="text-lg font-bold mb-2">Resume Bullets</h2>
                    <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm font-mono text-slate-800">
                        {bullets}
                    </pre>
                </div>
                )}
            </div>
        </main>
    );
}