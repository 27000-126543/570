import React, { useState, useEffect } from 'react'
import { Table, Tag, Input, Select, Space, Card, Button, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const { Search } = Input
const { Option } = Select

const roleMap = {
  employee: { text: '普通员工', color: 'blue' },
  supervisor: { text: '部门主管', color: 'orange' },
  trainer: { text: '培训管理员', color: 'purple' }
}

const getActionColor = (action) => {
  if (action?.includes('登录') || action?.includes('退出')) return 'purple'
  if (action?.includes('创建') || action?.includes('添加') || action?.includes('生成')) return 'green'
  if (action?.includes('更新') || action?.includes('修改') || action?.includes('上传')) return 'blue'
  if (action?.includes('删除') || action?.includes('取消')) return 'red'
  if (action?.includes('审批') || action?.includes('通过') || action?.includes('拒绝')) return 'orange'
  if (action?.includes('提交') || action?.includes('开始')) return 'cyan'
  return 'default'
}

const moduleOptions = [
  { value: '认证', label: '登录认证' },
  { value: '课程管理', label: '课程管理' },
  { value: '培训报名', label: '培训报名' },
  { value: '考试管理', label: '考试管理' },
  { value: '证书管理', label: '证书管理' },
  { value: '统计报告', label: '统计报告' }
]

const actionOptions = [
  { value: '登录', label: '登录' },
  { value: '退出', label: '退出登录' },
  { value: '创建', label: '创建' },
  { value: '更新', label: '更新' },
  { value: '删除', label: '删除' },
  { value: '上传', label: '上传' },
  { value: '报名', label: '报名' },
  { value: '审批', label: '审批' },
  { value: '开始', label: '开始考试' },
  { value: '提交', label: '提交考试' },
  { value: '生成', label: '生成' }
]

const user = JSON.parse(localStorage.getItem('user') || '{}')

export default function OperationLogs() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ module: '', action: '', keyword: '' })

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.module) params.module = filters.module
      if (filters.action) params.action = filters.action
      params.page = pagination.current
      params.pageSize = pagination.pageSize

      const res = await request.get('/logs', { params })
      setData(res.data?.list || [])
      setPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } catch (e) {
      message.error(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '操作时间', dataIndex: 'created_at', width: 170 },
    { title: '操作用户', dataIndex: 'username', width: 120 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: r => <Tag color={roleMap[r]?.color}>{roleMap[r]?.text || r}</Tag>
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      width: 140,
      render: t => <Tag color={getActionColor(t)}>{t || '-'}</Tag>
    },
    { title: '模块', dataIndex: 'module', width: 120, render: m => m || '-' },
    { title: '描述', dataIndex: 'description', render: d => d || '-' },
    { title: 'IP地址', dataIndex: 'ip', width: 140, render: ip => ip || '-' }
  ]

  if (user.role !== 'trainer') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">操作日志</h2>
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
        <h2 className="page-title">操作日志</h2>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索用户名/描述"
            style={{ width: 220 }}
            allowClear
            value={filters.keyword || undefined}
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Select
            placeholder="选择模块"
            style={{ width: 160 }}
            allowClear
            value={filters.module || undefined}
            onChange={v => setFilters(f => ({ ...f, module: v }))}
          >
            {moduleOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="操作类型"
            style={{ width: 140 }}
            allowClear
            value={filters.action || undefined}
            onChange={v => setFilters(f => ({ ...f, action: v }))}
          >
            {actionOptions.map(opt => (
              <Option key={opt.value} value={opt.value}>{opt.label}</Option>
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
