import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Select, Space, Card, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TrophyOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../../utils/request'

const { Option } = Select

const statusMap = {
  active: { text: '进行中', color: 'blue' },
  closed: { text: '已结束', color: 'default' }
}

const user = JSON.parse(localStorage.getItem('user') || '{}')

export default function ExamList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [courses, setCourses] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ course_id: '', status: '' })

  useEffect(() => {
    loadData()
    loadCourses()
  }, [pagination.current, pagination.pageSize, filters])

  const loadCourses = async () => {
    try {
      const res = await request.get('/courses', { params: { status: 'published', pageSize: 100 } })
      setCourses(res.data?.list || [])
    } catch (e) {}
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/exams', {
        params: { ...filters, page: pagination.current, pageSize: pagination.pageSize }
      })
      setData(res.data?.list || [])
      setPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await request.delete(`/exams/${id}`)
      message.success('删除成功')
      loadData()
    } catch (e) {}
  }

  const columns = [
    { title: '考试名称', dataIndex: 'name', width: 180 },
    { title: '课程名称', dataIndex: 'course_name', width: 180 },
    { title: '时长(分钟)', dataIndex: 'duration', width: 100 },
    { title: '总分', dataIndex: 'total_score', width: 80 },
    { title: '及格分', dataIndex: 'pass_score', width: 80 },
    { title: '题目数', dataIndex: 'question_count', width: 80 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    { title: '创建时间', dataIndex: 'created_at', width: 180 },
    {
      title: '操作', width: 240,
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/exams/${r.id}/edit`)}>编辑</Button>
          <Button type="link" icon={<TrophyOutlined />} onClick={() => navigate(`/exams/${r.id}/results`)}>查看成绩</Button>
          <Popconfirm title="确定删除该考试？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">考试管理</h2>
        {user.role === 'trainer' && (
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/exams/new')}>新建考试</Button>
          </Space>
        )}
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="按课程筛选"
            style={{ width: 200 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, course_id: v }))}
          >
            {courses.map(c => (
              <Option key={c.id} value={c.id}>{c.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="按状态筛选"
            style={{ width: 140 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, status: v }))}
          >
            <Option value="active">进行中</Option>
            <Option value="closed">已结束</Option>
          </Select>
          <Button onClick={loadData}>查询</Button>
        </Space>

        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
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
