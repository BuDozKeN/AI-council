"""
Script to replace ugly native selects with proper Radix UI components in ViewProjectModal.
"""

# Read the file
with open('frontend/src/components/MyCompany.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ==========================================
# FIX 1: Replace the status/department section with proper design system components
# ==========================================
old_code = '''          {/* Status, Department and info row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status badge */}
            {!isNew && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  background: getStatusColor(editedStatus).bg,
                  color: getStatusColor(editedStatus).text
                }}
              >
                {editedStatus}
              </span>
            )}
            {isEditing && !isNew && (
              <select
                value={editedStatus}
                onChange={(e) => setEditedStatus(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            )}

            {/* Department selector/display */}
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#666' }}>Department:</label>
                <select
                  value={editedDepartmentId}
                  onChange={(e) => setEditedDepartmentId(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">No Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            ) : project.department_name && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  background: '#f3e8ff',
                  color: '#7c3aed'
                }}
              >
                {project.department_name}
              </span>
            )}

            {/* Decision count */}
            {!isNew && project.decision_count > 0 && (
              <span style={{ fontSize: '13px', color: '#666' }}>
                {project.decision_count} decision{project.decision_count !== 1 ? 's' : ''} saved
              </span>
            )}
          </div>'''

new_code = '''          {/* Status, Department and info row */}
          <div className="mc-project-meta-row">
            {/* Status - shown as badge when viewing, select when editing */}
            {!isNew && !isEditing && (
              <span
                className="mc-status-badge"
                style={{
                  background: getStatusColor(editedStatus).bg,
                  color: getStatusColor(editedStatus).text
                }}
              >
                {editedStatus}
              </span>
            )}
            {isEditing && !isNew && (
              <StatusSelect
                value={editedStatus}
                onValueChange={setEditedStatus}
              />
            )}

            {/* Department - using design system DepartmentSelect */}
            {isEditing ? (
              <DepartmentSelect
                value={editedDepartmentId || 'all'}
                onValueChange={(val) => setEditedDepartmentId(val === 'all' ? '' : val)}
                departments={departments}
                includeAll={true}
                allLabel="No Department"
                showIcon={true}
              />
            ) : project.department_name && (
              <span
                className="mc-dept-badge"
                style={{
                  background: getDeptColor(project.department_id)?.bg || '#f3e8ff',
                  color: getDeptColor(project.department_id)?.text || '#7c3aed',
                  borderColor: getDeptColor(project.department_id)?.border || '#e9d5ff'
                }}
              >
                {project.department_name}
              </span>
            )}

            {/* Decision count */}
            {!isNew && project.decision_count > 0 && (
              <span className="mc-meta-info">
                {project.decision_count} decision{project.decision_count !== 1 ? 's' : ''} saved
              </span>
            )}
          </div>'''

content = content.replace(old_code, new_code)

# Write the file
with open('frontend/src/components/MyCompany.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced ugly selects with design system components!")
