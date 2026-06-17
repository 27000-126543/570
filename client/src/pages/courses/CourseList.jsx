import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Input, Select, Space, Card, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, EyeOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../../utils/request'

const { Search } = Input
const { Option } = Select

const statusMap = {
  draft: { text: '草稿', color: 'default' },
  published: { text: '已发布', color: 'blue' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' }
}

const user = JSON.parse(localStorage.getItem('user') || '{}')

export default function CourseList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '', keyword: '' })

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/courses', {
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
      await request.delete(`/courses/${id}`)
      message.success('删除成功')
      loadData()
    } catch (e) {}
  }

  const columns = [
    { title: '课程编码', dataIndex: 'code', width: 120 },
    {
      title: '课程名称', dataIndex: 'name', render: (t, r) => (
        <a onClick={() => navigate(`/courses/${r.id}`)}>{t}</a>
      )
    },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '学时', dataIndex: 'hours', width: 80 },
    { title: '要求学前学时', dataIndex: 'required_hours', width: 120 },
    { title: '名额', dataIndex: 'capacity', width: 80, render: (t, r) => `${r.enrolled_count || 0}/${t}` },
    { title: '开始时间', dataIndex: 'start_date', width: 120 },
    { title: '结束时间', dataIndex: 'end_date', width: 120 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    {
      title: '操作', width: user.role === 'trainer' ? 280 : 120,
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/courses/${r.id}`)}>详情</Button>
          {user.role === 'trainer' && (
            <>
              <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/courses/${r.id}/edit`)}>编辑</Button>
              <Button type="link" icon={<QuestionCircleOutlined />} onClick={() => navigate(`/courses/${r.id}/questions`)}>题库</Button>
              <Popconfirm title="确定删除该课程？" onConfirm={() => handleDelete(r.id)}>
                <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">课程管理</h2>
        {user.role === 'trainer' && (
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/courses/new')}>新建课程</Button>
          </Space>
        )}
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索课程名称/编码"
            style={{ width: 240 }}
            allowClear
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Select
            placeholder="课程状态"
            style={{ width: 140 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, status: v }))}
          >
            <Option value="draft">草稿</Option>
            <Option value="published">已发布</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
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
