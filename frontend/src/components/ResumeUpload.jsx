import React, { useState } from 'react';
import axios from 'axios';

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onFileChange = e => {
    setFile(e.target.files[0]);
    setParsed(null);
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a resume PDF'); return; }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      const res = await axios.post('http://localhost:5000/api/resume/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParsed(res.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-2">Upload Resume (PDF)</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="file" accept="application/pdf" onChange={onFileChange} />
        <div>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
            {loading ? 'Uploading...' : 'Upload & Parse'}
          </button>
        </div>
      </form>

      {error && <div className="mt-3 text-red-600">{error}</div>}

      {parsed && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <h3 className="font-medium">Parsed Result</h3>
          <p><strong>Filename:</strong> {parsed.filename}</p>
          <p><strong>Email:</strong> {parsed.email || 'Not found'}</p>
          <p><strong>Phone:</strong> {parsed.phone || 'Not found'}</p>
          <p><strong>Skills:</strong> {parsed.skills && parsed.skills.length ? parsed.skills.join(', ') : 'None detected'}</p>
          <small className="text-gray-500 block mt-2">Resume ID: {parsed.id}</small>
        </div>
      )}
    </div>
  );
}
