import React, { useState, useEffect } from 'react'
import { Table, Tag, Input, Select, Space, Card, Button, Modal, message } from 'antd'
import { EyeOutlined, SearchOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const { Search } = Input
const { Option } = Select

const statusMap = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'default' },
  escalated: { text: '超时升级', color: 'red' }
}

const transformRecord = (r) => ({
  ...r,
  user: {
    name: r.user_name,
    department: r.department,
    position: r.position,
    phone: r.phone,
    email: r.email
  },
  course: {
    name: r.course_name,
    code: r.course_code,
    hours: r.hours,
    category: r.category,
    teacher: r.teacher
  },
  approver: {
    name: r.approver_name
  },
  created_at: r.apply_time,
  approved_at: r.approve_time
})

export default function EnrollmentList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [courses, setCourses] = useState([])
  const [departments, setDepartments] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ course_id: '', status: '', department: '', keyword: '' })
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)

  useEffect(() => {
    loadData()
    loadCourses()
    loadDepartments()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.course_id) params.course_id = filters.course_id
      if (filters.department) params.department = filters.department
      if (filters.status) params.status = filters.status
      if (filters.keyword) params.keyword = filters.keyword
      params.page = pagination.current
      params.pageSize = pagination.pageSize

      const res = await request.get('/enrollments', { params })
      setData((res.data?.list || []).map(transformRecord))
      setPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } catch (e) {
      message.error(e?.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const loadCourses = async () => {
    try {
      const res = await request.get('/courses', { params: { pageSize: 100, page: 1 } })
      setCourses(res.data?.list || [])
    } catch (e) {}
  }

  const loadDepartments = async () => {
    try {
      const res = await request.get('/users/departments')
      setDepartments(res.data || [])
    } catch (e) {}
  }

  const handleViewDetail = (record) => {
    setCurrentRecord(record)
    setDetailModalVisible(true)
  }

  const columns = [
    { title: '课程名称', dataIndex: ['course', 'name'], width: 200 },
    { title: '学员姓名', dataIndex: ['user', 'name'], width: 120 },
    { title: '部门', dataIndex: ['user', 'department'], width: 120 },
    { title: '职位', dataIndex: ['user', 'position'], width: 120 },
    { title: '报名时间', dataIndex: 'created_at', width: 160 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    { title: '审批人', dataIndex: ['approver', 'name'], width: 120 },
    { title: '审批时间', dataIndex: 'approved_at', width: 160 },
    {
      title: '操作', width: 100,
      render: (_, r) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>详情</Button>
      )
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">报名管理</h2>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索学员姓名"
            style={{ width: 200 }}
            allowClear
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Select
            placeholder="选择课程"
            style={{ width: 200 }}
            allowClear
            value={filters.course_id || undefined}
            onChange={v => setFilters(f => ({ ...f, course_id: v }))}
          >
            {courses.map(course => (
              <Option key={course.id} value={course.id}>{course.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="选择部门"
            style={{ width: 160 }}
            allowClear
            value={filters.department || undefined}
            onChange={v => setFilters(f => ({ ...f, department: v }))}
          >
            {departments.map(dept => (
              <Option key={dept.name} value={dept.name}>{dept.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="报名状态"
            style={{ width: 140 }}
            allowClear
            value={filters.status || undefined}
            onChange={v => setFilters(f => ({ ...f, status: v }))}
          >
            <Option value="pending">待审批</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已拒绝</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
            <Option value="escalated">超时升级</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
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

      <Modal
        title="报名详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={600}
      >
        {currentRecord && (
          <div className="detail-content">
            <p><strong>课程名称：</strong>{currentRecord.course?.name}</p>
            <p><strong>课程编码：</strong>{currentRecord.course?.code}</p>
            <p><strong>课程分类：</strong>{currentRecord.course?.category}</p>
            <p><strong>学时：</strong>{currentRecord.course?.hours}学时</p>
            <p><strong>讲师：</strong>{currentRecord.course?.teacher}</p>
            <p><strong>学员姓名：</strong>{currentRecord.user?.name}</p>
            <p><strong>部门：</strong>{currentRecord.user?.department}</p>
            <p><strong>职位：</strong>{currentRecord.user?.position}</p>
            <p><strong>联系电话：</strong>{currentRecord.user?.phone}</p>
            <p><strong>邮箱：</strong>{currentRecord.user?.email}</p>
            <p><strong>报名时间：</strong>{currentRecord.created_at}</p>
            <p><strong>状态：</strong>
              <Tag color={statusMap[currentRecord.status]?.color}>
                {statusMap[currentRecord.status]?.text}
              </Tag>
            </p>
            <p><strong>审批人：</strong>{currentRecord.approver?.name || '-'}</p>
            <p><strong>审批时间：</strong>{currentRecord.approved_at || '-'}</p>
            {currentRecord.reject_reason && (
              <p><strong>拒绝原因：</strong>{currentRecord.reject_reason}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
