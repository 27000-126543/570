import React, { useState, useEffect } from 'react'
import { Table, Tag, Input, Select, Space, Card, Button } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const { Search } = Input
const { Option } = Select

const roleMap = {
  employee: { text: '普通员工', color: 'blue' },
  supervisor: { text: '部门主管', color: 'orange' },
  trainer: { text: '培训管理员', color: 'purple' }
}

const typeMap = {
  create: { text: '创建', color: 'green' },
  update: { text: '更新', color: 'blue' },
  delete: { text: '删除', color: 'red' },
  login: { text: '登录', color: 'purple' },
  logout: { text: '注销', color: 'default' },
  export: { text: '导出', color: 'cyan' },
  import: { text: '导入', color: 'geekblue' },
  approve: { text: '审批', color: 'orange' },
  default: { text: '其他', color: 'default' }
}

const moduleOptions = [
  { value: 'users', label: '用户管理' },
  { value: 'courses', label: '课程管理' },
  { value: 'exams', label: '考试管理' },
  { value: 'enrollments', label: '报名管理' },
  { value: 'certificates', label: '证书管理' },
  { value: 'notifications', label: '消息通知' },
  { value: 'system', label: '系统设置' }
]

const typeOptions = [
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'login', label: '登录' },
  { value: 'logout', label: '注销' },
  { value: 'export', label: '导出' },
  { value: 'import', label: '导入' },
  { value: 'approve', label: '审批' }
]

const user = JSON.parse(localStorage.getItem('user') || '{}')

export default function OperationLogs() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ module: '', operationType: '', keyword: '' })

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/operation-logs', {
        params: {
          ...filters,
          page: pagination.current,
          pageSize: pagination.pageSize
        }
      })
      setData(res.data?.list || [])
      setPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '操作时间', dataIndex: 'created_at', width: 160, sorter: true, defaultSortOrder: 'descend' },
    { title: '操作用户', dataIndex: ['user', 'name'], width: 120 },
    {
      title: '角色',
      dataIndex: ['user', 'role'],
      width: 120,
      render: r => <Tag color={roleMap[r]?.color}>{roleMap[r]?.text}</Tag>
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      width: 100,
      render: t => <Tag color={typeMap[t]?.color || typeMap.default.color}>{typeMap[t]?.text || typeMap.default.text}</Tag>
    },
    { title: '模块', dataIndex: 'module', width: 120 },
    { title: '描述', dataIndex: 'description' },
    { title: 'IP地址', dataIndex: 'ip', width: 140 }
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
            placeholder="搜索关键词"
            style={{ width: 220 }}
            allowClear
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Select
            placeholder="选择模块"
            style={{ width: 160 }}
            allowClear
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
            onChange={v => setFilters(f => ({ ...f, operationType: v }))}
          >
            {typeOptions.map(opt => (
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
          scroll={{ x: 1100 }}
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
