import React, { useState, useEffect } from 'react'
import { Table, Tag, Input, Select, Space, Card, Button, message } from 'antd'
import { SearchOutlined, ProfileOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../../utils/request'

const { Search } = Input
const { Option } = Select

const roleMap = {
  employee: { text: '普通员工', color: 'blue' },
  supervisor: { text: '部门主管', color: 'orange' },
  trainer: { text: '培训管理员', color: 'purple' }
}

const user = JSON.parse(localStorage.getItem('user') || '{}')

export default function UserList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [departments, setDepartments] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ role: '', department: '', keyword: '' })

  useEffect(() => {
    loadData()
    loadDepartments()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/users', {
        params: { ...filters, page: pagination.current, pageSize: pagination.pageSize }
      })
      setData(res.data?.list || [])
      setPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const res = await request.get('/users/departments')
      setDepartments(res.data || [])
    } catch (e) {}
  }

  const handleViewSkillProfile = (record) => {
    navigate(`/users/${record.id}/profile`)
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: r => <Tag color={roleMap[r]?.color}>{roleMap[r]?.text}</Tag>
    },
    { title: '部门', dataIndex: 'department', width: 120 },
    { title: '职位', dataIndex: 'position', width: 120 },
    { title: '电话', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 180 },
    { title: '总学时', dataIndex: 'total_hours', width: 90, render: t => t || 0 },
    { title: '创建时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作',
      width: 130,
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            icon={<ProfileOutlined />}
            onClick={() => handleViewSkillProfile(r)}
          >
            技能档案
          </Button>
        </Space>
      )
    }
  ]

  if (user.role !== 'trainer') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">用户管理</h2>
        </div>
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            您没有权限访问该页面
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">用户管理</h2>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索姓名/用户名"
            style={{ width: 220 }}
            allowClear
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Select
            placeholder="选择角色"
            style={{ width: 140 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, role: v }))}
          >
            <Option value="employee">普通员工</Option>
            <Option value="supervisor">部门主管</Option>
            <Option value="trainer">培训管理员</Option>
          </Select>
          <Select
            placeholder="选择部门"
            style={{ width: 160 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, department: v }))}
          >
            {departments.map(dept => (
              <Option key={dept} value={dept}>{dept}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
        </Space>

        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => setPagination({ ...pagination, current: p, pageSize: ps })
          }}
        />
      </Card>
    </div>
  )
}
