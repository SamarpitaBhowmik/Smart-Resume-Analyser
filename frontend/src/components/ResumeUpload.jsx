import React, { useState } from 'react';
import axios from 'axios';

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onFileChange = (e) => {
    setFile(e.target.files[0]);
    setParsed(null);
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a resume PDF');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      const res = await axios.post('http://localhost:5000/api/resume/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
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
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {loading ? 'Uploading...' : 'Upload & Parse'}
          </button>
        </div>
      </form>

      {error && <div className="mt-3 text-red-600">{error}</div>}

      {parsed && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <h3 className="font-medium">Parsed Result</h3>
          <p><strong>Filename:</strong> {parsed.filename || 'Not found'}</p>
          <p><strong>Name:</strong> {parsed.extracted?.name || 'Not found'}</p>
          <p>
            <strong>Skills:</strong>{' '}
            {parsed.extracted?.skills?.length
              ? parsed.extracted.skills.join(', ')
              : 'None detected'}
          </p>

          <div className="mt-2">
            <strong>Projects:</strong>
            {parsed.extracted?.projects?.length ? (
              <ul className="list-disc pl-6">
                {parsed.extracted.projects.map((proj, i) => (
                  <li key={i} className="mb-2">
                    <p><strong>{proj.name}</strong></p>
                    <p>{proj.description}</p>
                    {proj.technologies?.length > 0 && (
                      <p><em>Tech:</em> {proj.technologies.join(', ')}</p>
                    )}
                    {proj.impact?.length > 0 && (
                      <ul className="list-disc pl-6 text-sm text-gray-600">
                        {proj.impact.map((imp, j) => (
                          <li key={j}>{imp}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>None detected</p>
            )}
          </div>

          <div className="mt-2">
            <strong>Education:</strong>
            {parsed.extracted?.education?.length ? (
              <ul className="list-disc pl-6">
                {parsed.extracted.education.map((edu, i) => (
                  <li key={i} className="mb-2">
                    <p><strong>{edu.degree}</strong></p>
                    <p>{edu.institution || 'Institution not specified'}</p>
                    <p>GPA: {edu.gpa || 'N/A'}</p>
                    <p>Dates: {edu.dates || 'N/A'}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>None detected</p>
            )}
          </div>

          <small className="text-gray-500 block mt-2">
            Resume ID: {parsed.id}
          </small>
        </div>
      )}
    </div>
  );
}
